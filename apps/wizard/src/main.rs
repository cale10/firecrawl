use std::{fs, path::{Path, PathBuf}};

use oxc_ast::ast::{Argument, CallExpression, Declaration, Expression, FormalParameterKind, ImportDeclarationSpecifier, ImportOrExportKind, Program, Statement, VariableDeclaration, VariableDeclarationKind};
use oxc_parser::Parser;
use oxc_resolver::{ResolveOptions, TsconfigOptions, TsconfigReferences};
use oxc_span::SourceType;
use oxc_allocator::Allocator;
use regex::Regex;

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

fn handle_controller(route: &Route) {
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

    let req_param = function.params.items.iter().nth(0).unwrap();

    let x = &req_param.pattern.type_annotation;

    println!("{:?}", x);

}

fn main() {
    let path = Path::new("../api/src/index.ts");
    let routes = navigate_router_tree(path, "app", "");
    println!("{:#?}", routes);

    for route in routes {
        println!("{} ({}##{})", route.path, route.handler_file_path.display(), route.handler_identifier);
        handle_controller(&route);
    }
}