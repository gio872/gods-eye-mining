module.exports = {
  version: "1.0",
  title: "Start GEM",
  description: "Start the GEM local web application",
  run: [
    {
      method: "shell.run",
      params: {
        message: "npm run dev -- --host 127.0.0.1"
      },
      next: [
        {
          method: "local.set",
          params: {
            url: "{{input.event[0]}}"
          }
        }
      ]
    },
    {
      method: "local.set",
      params: {
        url: "http://127.0.0.1:5173"
      }
    }
  ]
}
