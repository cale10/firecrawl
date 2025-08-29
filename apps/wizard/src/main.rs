use std::{fs, path::{Path, PathBuf}};

use oxc_ast::ast::{Argument, CallExpression, Declaration, Expression, ImportDeclarationSpecifier, ImportOrExportKind, Program, Statement, VariableDeclaration, VariableDeclarationKind};
use oxc_parser::Parser;
use oxc_resolver::{ResolveOptions, TsconfigOptions, TsconfigReferences};
use oxc_span::SourceType;
use oxc_allocator::Allocator;

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
                    _ => None
                }
            },
            Statement::ImportDeclaration(x) => {
                if let Some(spec) = &x.specifiers {
                    spec.iter().find_map(|y| {
                        match y {
                            ImportDeclarationSpecifier::ImportSpecifier(y) => {
                                if y.import_kind == ImportOrExportKind::Value {
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

fn navigate_router_tree(root: &Path, identifier: &str, prefix: &str) {
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
        // println!("{:?}", stmt);
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

    // let routes = Vec::new();

    for call in router_calls {
        // println!("{}/{}", call.method_name, call.call.arguments.len());

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
                println!("subrouter used: {}", router_identifier);

                let definition = find_root_definition(root, &ast.program, &router_identifier);
                if let Some((file_path, identifier)) = definition {
                    println!("found root definition: {} {}", file_path.display(), identifier);
                    navigate_router_tree(&file_path, &identifier, &path);
                } else {
                    eprintln!("warn: no root definition found for {}", router_identifier);
                }
            }
        } else if let Some(path) = path {
            if call.method_name == "get" || call.method_name == "post" || call.method_name == "put" || call.method_name == "delete" {
                println!("{} {}{}", call.method_name, prefix, path);
            } else {
                eprintln!("warn: unsupported method: {}", call.method_name);
            }
        }
    }
}

fn main() {
    let path = Path::new("../api/src/index.ts");
    navigate_router_tree(path, "app", "");
}