# ugit workflow contract

The current ugit runner expects each workflow to live under
`.ugit/workflows/<workflow>/`.

Required package shape:

- the workflow directory exists under `.ugit/workflows/<workflow>/`
- `package.json` exists in that directory
- `package.json` defines a `ugit:ci` script

Runner behavior:

- `pnpm install --dir <workflow> --ignore-workspace --no-frozen-lockfile`
- `pnpm --dir <workflow> run ugit:ci`

Recommended scaffold for this skill:

- `package.json` from `templates/package.json.template.json`
- `run-ugit-ci.sh` from `templates/run-ugit-ci.sh.template`

Why the shell wrapper exists:

- ugit runs the workflow package from inside `.ugit/workflows/<workflow>/`
- most repositories want the real validation command to run from the repository
  root instead of from the workflow package directory
- the wrapper can return to `../../..` and execute the confirmed repository
  command without assuming the repository itself is pnpm-based

Guardrails:

- keep the workflow package minimal; do not recreate the repository's full tool
  chain inside `.ugit/workflows/<workflow>/`
- do not emit placeholder commands when command inference is weak; ask the user
  for the exact validation command instead
