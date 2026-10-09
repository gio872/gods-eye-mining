module.exports = {
  version: "1.0",
  title: "Install GEM",
  description: "Install GEM without Python or Earth Engine prerequisites",
  run: [
    {
      method: "shell.run",
      params: {
        message: [
          "npm ci --ignore-scripts",
          "node -e \"console.log('[GEM] Node dependencies installed successfully.')\""
        ]
      }
    }
  ]
}
