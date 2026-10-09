module.exports = {
  version: "1.0",
  title: "Enable Google Earth Engine",
  description: "Create a dedicated GEM Python environment and install earthengine-api",
  run: [
    {
      method: "shell.run",
      params: {
        venv: "gem-python",
        message: "python -m pip install --upgrade earthengine-api"
      }
    }
  ]
}
