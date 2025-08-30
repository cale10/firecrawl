use std::{fs, path::{Path, PathBuf}};

use indexmap::IndexMap;
use openapiv3::{Components, Contact, Info, OpenAPI, Operation, PathItem, ReferenceOr, SecurityRequirement, SecurityScheme, Server, APIKeyLocation};
use oxc_ast::ast::{Argument, CallExpression, Declaration, Expression, ImportDeclarationSpecifier, Program, Statement, VariableDeclaration, VariableDeclarationKind};
use oxc_parser::Parser;
use oxc_resolver::{ResolveOptions, TsconfigOptions, TsconfigReferences};
use oxc_span::SourceType;
use oxc_allocator::Allocator;
use regex::Regex;
use serde_json::json;

fn find_root_definition<'a>(path: &Path, program: &'a Program<'a>, identifier: &str) -> Option<(PathBuf, String)> {
    fn handle_variable_declaration<'a>(x: &oxc_allocator::Box<'a, VariableDeclaration<'a>>, identifier: &str, path: &Path) -> Option<(PathBuf, String)> {
        if x.kind == VariableDeclarationKind::Const {
            x.declarations.iter().find_map(|x| {
                if let Some(id) = x.id.get_identifier_name() && id == identifier {
                    Some((path.to_path_buf(), id.to_string()))
                } else {
                    None
                }
            })
        } else {
            None
        }
    }

    program.body.iter().find_map(|x| {
        match x {
            Statement::VariableDeclaration(x) => {
                handle_variable_declaration(x, identifier, path)
            },
            Statement::ExportNamedDeclaration(x) => {
                match &x.declaration {
                    Some(Declaration::VariableDeclaration(x)) => {
                        handle_variable_declaration(&x, identifier, path)
                    }
                    Some(Declaration::FunctionDeclaration(x)) => {
                        if let Some(id) = &x.id && id.name == identifier {
                            Some((path.to_path_buf(), id.name.to_string()))
                        } else {
                            None
                        }
                    }
                    Some(Declaration::TSTypeAliasDeclaration(x)) => {
                        if x.id.name == identifier {
                            Some((path.to_path_buf(), x.id.name.to_string()))
                        } else {
                            None
                        }
                    }
                    _ => None
                }
            },
            Statement::ImportDeclaration(x) => {
                if let Some(spec) = &x.specifiers {
                    spec.iter().find_map(|y| {
                        match y {
                            ImportDeclarationSpecifier::ImportSpecifier(y) => {
                                if y.local.name == identifier {
                                    let external_name = y.imported.name();
                                    let resolver = oxc_resolver::Resolver::new(ResolveOptions {
                                        tsconfig: Some(TsconfigOptions {
                                            config_file: PathBuf::from("../api/tsconfig.json"),
                                            references: TsconfigReferences::Auto,
                                        }),
                                        extensions: vec![".js".to_string(), ".ts".to_string()],
                                        ..Default::default()
                                    });

                                    let resolution = resolver.resolve(std::path::absolute(path.parent().unwrap()).unwrap(), &x.source.value).unwrap();

                                    let path = resolution.path();
                                    let source_text = fs::read_to_string(path).unwrap();
                                    let source_type = SourceType::from_path(path).unwrap();
                                    let allocator = Allocator::default();
                                    let parser = Parser::new(&allocator, &source_text, source_type);
                                    let ast = parser.parse();

                                    find_root_definition(path, &ast.program, &external_name)
                                } else {
                                    None
                                }
                            },
                            _ => None
                        }
                    })
                } else {
                    None
                }
            },
            _ => None
        }
    })
}

#[derive(Debug, Clone, Copy)]
enum RouteMethod {
    Get,
    Post,
    Put,
    Delete,
}

#[derive(Debug, Clone)]
struct Route {
    method: RouteMethod,
    path: String,

    handler_identifier: String,
    handler_file_path: PathBuf,

    has_auth: bool,
}

fn navigate_router_tree(root: &Path, identifier: &str, prefix: &str) -> Vec<Route> {
    let source_text = fs::read_to_string(root).unwrap();
    let source_type = SourceType::from_path(root).unwrap();
    let allocator = Allocator::default();
    let parser = Parser::new(&allocator, &source_text, source_type);
    let ast = parser.parse();

    struct RouterCall<'a> {
        method_name: String,
        call: &'a oxc_allocator::Box<'a, CallExpression<'a>>,
    }

    let router_calls = ast.program.body.iter().filter_map(|stmt| {
        match stmt {
            Statement::ExpressionStatement(expr) => {
                match &expr.expression {
                    Expression::CallExpression(call) => {
                        match &call.callee {
                            Expression::StaticMemberExpression(member) => {
                                match &member.object {
                                    Expression::Identifier(id) => {
                                        if id.name == identifier {
                                            Some(RouterCall {
                                                method_name: member.property.name.to_string(),
                                                call: call,
                                            })
                                        } else {
                                            None
                                        }
                                    }
                                    _ => None
                                }
                            },
                            _ => None
                        }
                    }
                    _ => None
                }
            },
            _ => None
        }
    });

    let should_include_path = Regex::new(r"^/v[12]+").unwrap();

    let routes = router_calls.filter_map(|call| {
        let arg_1 = call.call.arguments.get(0).unwrap();

        let path = match arg_1 {
            Argument::StringLiteral(str) => {
                Some(str.value.to_string())
            },
            Argument::TemplateLiteral(template) => {
                if let Some(quasi) = template.single_quasi() {
                    Some(quasi.to_string())
                } else {
                    eprintln!("warn: unsupported template literal");
                    None
                }
            },
            _ => None
        };

        if call.method_name == "use" {
            let (path, next_arg) = if let Some(path) = path {
                (path, call.call.arguments.get(1).unwrap())
            } else {
                (prefix.to_string(), call.call.arguments.get(0).unwrap())
            };

            let router_identifier = match next_arg {
                Argument::Identifier(id) => {
                    Some(id.name.to_string())
                },
                _ => {
                    None
                },
            };

            if let Some(router_identifier) = router_identifier {
                let definition = find_root_definition(root, &ast.program, &router_identifier);
                if let Some((file_path, identifier)) = definition {
                    Some(navigate_router_tree(&file_path, &identifier, &path))
                } else {
                    eprintln!("warn: no root definition found for {}", router_identifier);
                    None
                }
            } else {
                None
            }
        } else if let Some(path) = path {
            if call.method_name == "get" || call.method_name == "post" || call.method_name == "put" || call.method_name == "delete" {
                let path = prefix.to_string() + &path;
                if should_include_path.is_match(&path) {
                    let last_arg = call.call.arguments.get(call.call.arguments.len() - 1).unwrap();
                    let request_handler_identifier = match last_arg {
                        Argument::Identifier(id) => {
                            Some(id.name.to_string())
                        },
                        Argument::CallExpression(call) => {
                            if call.callee_name() == Some("wrap") {
                                match &call.arguments.first().unwrap() {
                                    Argument::Identifier(id) => {
                                        Some(id.name.to_string())
                                    },
                                    _ => None
                                }
                            } else {
                                None
                            }
                        },
                        _ => None
                    };

                    if let Some(request_handler_identifier) = request_handler_identifier {
                        let method = match call.method_name.as_str() {
                            "get" => RouteMethod::Get,
                            "post" => RouteMethod::Post,
                            "put" => RouteMethod::Put,
                            "delete" => RouteMethod::Delete,
                            _ => unreachable!()
                        };

                        if let Some((handler_file_path, handler_identifier)) = find_root_definition(root, &ast.program, &request_handler_identifier) {
                            let route = Route {
                                method,
                                path,
                                handler_identifier,
                                handler_file_path,

                                has_auth: call.call.arguments.iter().any(|x| match x {
                                    Argument::Identifier(x) => {
                                        if x.name == "authMiddleware" {
                                            return true;
                                        } else {
                                            return false;
                                        }
                                    },
                                    Argument::CallExpression(x) => {
                                        if let Some(id) = x.callee.get_identifier_reference() && id.name == "authMiddleware"{
                                            return true;
                                        } else {
                                            return false;
                                        }
                                    }
                                    _ => false
                                }),
                            };

                            Some(vec![route])
                        } else {
                            eprintln!("warn: no handler definition found for {}", request_handler_identifier);
                            None
                        }
                    } else {
                        eprintln!("warn: {} {} has no handler", call.method_name, path);
                        None
                    }
                } else {
                    None
                }
            } else {
                eprintln!("warn: unsupported method: {}", call.method_name);
                None
            }
        } else {
            None
        }
    }).flatten().collect::<Vec<_>>();

    routes
}

fn route_to_openapi_operation(route: &Route) -> Operation {
    let source_text = fs::read_to_string(&route.handler_file_path).unwrap();
    let source_type = SourceType::from_path(&route.handler_file_path).unwrap();
    let allocator = Allocator::default();
    let parser = Parser::new(&allocator, &source_text, source_type);
    let ast = parser.parse();

    let function = ast.program.body.iter().find_map(|stmt| {
        match stmt {
            Statement::ExportNamedDeclaration(x) => {
                if let Some(Declaration::FunctionDeclaration(x)) = &x.declaration {
                    if let Some(id) = &x.id && id.name == route.handler_identifier {
                        Some(x)
                    } else {
                        None
                    }
                } else {
                    None
                }
            },
            _ => None
        }
    }).unwrap();

    let fn_block_comment = ast.program.comments
        .iter()
        .filter(|x| x.span.end < function.span.start)
        .last()
        .map(|x| x.span.source_text(&source_text).to_string())
        .unwrap_or("".to_string());

    let fn_block_comment = fn_block_comment
        .lines()
        .map(|x| x.trim_start_matches([' ', '/', '*']).trim_end())
        .skip(1)
        .take(if fn_block_comment.len() < 2 { 0 } else { fn_block_comment.len() - 2 })
        .collect::<Vec<_>>();

    let public_lines = {
        let first_declaration = fn_block_comment.iter().enumerate().find(|(_, x)| x.starts_with("@")).map(|(i, _)| i).unwrap_or(fn_block_comment.len());
        fn_block_comment.iter().take(first_declaration).map(|x| *x).collect::<Vec<_>>()
    };

    let title = fn_block_comment.iter().find(|x: &&&str| x.starts_with("@title ")).map(|x| x.trim_start_matches("@title ").trim_end().to_string()).unwrap_or("".to_string());
    let tags = fn_block_comment.iter().find(|x| x.starts_with("@tags ")).map(|x| x.trim_start_matches("@tags ").trim_end().split(", ").map(|x| x.to_string()).collect::<Vec<_>>()).unwrap_or(vec![]);
    let operation_id = fn_block_comment.iter().find(|x| x.starts_with("@operationId ")).map(|x| x.trim_start_matches("@operationId ").trim_end().to_string());

    let mut operation = Operation::default();
    operation.operation_id = operation_id;
    operation.summary = public_lines.first().map(|x| x.to_string());
    operation.description = Some(public_lines.join("\n"));
    operation.tags = tags;
    operation.extensions.insert("x-mint".to_string(), json!({
        "content": public_lines.join("\n"),
        "metadata": {
            "title": title,
        },
    }));

    // TODO: Add SDK examples via Mintlify: https://mintlify.com/docs/api-playground/customization/adding-sdk-examples

    if route.has_auth {
        operation.security = Some(vec![SecurityRequirement::from([("APIKey".to_string(), vec![])])]);
    }

    operation
}

fn make_file_from_version(routes: &Vec<Route>, version: &str) -> OpenAPI {
    let mut routes_by_path: IndexMap<String, Vec<Route>> = IndexMap::with_capacity(routes.len());

    let routes = routes.iter().filter(|x| x.path.starts_with(&(version.to_string() + "/"))).map(|x| {
        let mut route = x.clone();
        route.path = route.path.replace(version, "");
        route
    });

    for route in routes {
        routes_by_path.entry(route.path.clone()).or_insert(vec![]).push(route);
    }

    let mut openapi = OpenAPI::default();
    openapi.openapi = "3.0.0".to_string();

    openapi.info = Info {
        title: "Firecrawl API".to_string(),
        version: version[2..].to_string() + ".0.0",
        description: Some("API for interacting with Firecrawl services to perform web scraping and crawling tasks.".to_string()),
        contact: Some(Contact {
            name: Some("Firecrawl Support".to_string()),
            url: Some("https://firecrawl.dev/support".to_string()),
            email: Some("support@firecrawl.dev".to_string()),
            ..Default::default()
        }),
        ..Default::default()
    };

    openapi.servers = vec![Server {
        url: "https://api.firecrawl.dev".to_string() + version,
        ..Default::default()
    }];

    openapi.components = Some(Components {
        security_schemes: IndexMap::from([("APIKey".to_string(), ReferenceOr::Item(SecurityScheme::APIKey {
            location: APIKeyLocation::Header,
            name: "Authorization".to_string(),
            description: Some("The API key used for authentication. Use a bearer token prefixed with 'Bearer '.".to_string()),
            extensions: IndexMap::new(),
        }))]),
        ..Default::default()
    });

    for (path, routes) in routes_by_path {
        let mut path_item = PathItem::default();
        for route in routes {
            let op = route_to_openapi_operation(&route);
            match route.method {
                RouteMethod::Get => {
                    path_item.get = Some(op);
                }
                RouteMethod::Post => {
                    path_item.post = Some(op);
                }
                RouteMethod::Put => {
                    path_item.put = Some(op);
                }
                RouteMethod::Delete => {
                    path_item.delete = Some(op);
                }
            }
        }
        openapi.paths.paths.insert(path, openapiv3::ReferenceOr::Item(path_item));
    }

    openapi
}

fn main() {
    let path = Path::new("../api/src/index.ts");
    let routes = navigate_router_tree(path, "app", "");

    let v1= make_file_from_version(&routes, "/v1");
    let v2 = make_file_from_version(&routes, "/v2");

    fs::write("v1-openapi.json", serde_json::to_string_pretty(&v1).unwrap()).unwrap();
    fs::write("v2-openapi.json", serde_json::to_string_pretty(&v2).unwrap()).unwrap();
}