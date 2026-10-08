module.exports = {
  run: [
    {
      method: 'shell.run',
      params: {
        path: '..',
        message: 'node scripts/configure-earthengine.mjs',
      },
    },
  ],
};
