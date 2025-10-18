gsettings_schema = 'com.eweaver.adw_bluetooth.gschema.xml'

# Install GSettings schema
install_data(gsettings_schema,
  install_dir: join_paths(get_option('datadir'), 'glib-2.0/schemas')
)

compile_schemas = find_program('glib-compile-schemas', required: false)
if compile_schemas.found()
  test('Validate schema file',
    compile_schemas,
    args: ['--strict', '--dry-run', meson.current_source_dir()]
  )
endif


# Grab all ui/*.blp files
# Crazy idea! If the code is in the repo, it probably needs to get compiled!
c = run_command('bash', '-c', 'ls ui/*.blp', check: true)
sources = c.stdout().strip().split('\n')

blueprints = custom_target('blueprints',
  input: sources,
  output: '.',
  command: [find_program('blueprint-compiler'), 'batch-compile', '@OUTPUT@', '@CURRENT_SOURCE_DIR@', '@INPUT@'],
)

# Compile GResources (UI, icons, etc.)
data_res = gnome.compile_resources(
  'com.eweaver.adw_bluetooth.data',
  'com.eweaver.adw_bluetooth.data.gresource.xml',
  gresource_bundle: true,
  install: true,
  install_dir: pkgdatadir,
  dependencies: blueprints,
)