# Contributing

1. Fork this repo and clone your fork.
2. Create a branch: `git checkout -b my-change`
3. Make your change. Keep tools zero-dependency where possible
   (CommonJS `.cjs`, Node 18+ built-ins first).
4. Test it live and paste the real output in your PR description.
5. Commit, push, and open a Pull Request against `main`.

Style notes:

- Progress/info goes to stderr, data to stdout or `--out`.
- Never fake output: if a source blocks you, fail loudly with the reason.
- Mark blocked or key-required sources honestly in comments and README.
