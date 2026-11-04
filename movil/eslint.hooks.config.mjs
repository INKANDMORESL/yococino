// Solo comprueba las reglas de los hooks de React (useState, useEffect… siempre antes de cualquier «return»).
// Un hook después de un «return» cierra la app en el móvil. Lo ejecuta GitHub en «Comprobar app»,
// con ESLint instalado aparte (carpeta LINT_DIR) para no tocar las dependencias de la app.
import { createRequire } from 'node:module';

const require = createRequire(`${process.env.LINT_DIR ?? '/tmp/lint'}/`);
const tseslint = require('typescript-eslint');
const reactHooks = require('eslint-plugin-react-hooks');

export default [
  { ignores: ['node_modules/**', 'dist/**', '.expo/**'] },
  {
    files: ['app/**/*.tsx', 'src/**/*.tsx', 'src/**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    plugins: { 'react-hooks': reactHooks },
    rules: { 'react-hooks/rules-of-hooks': 'error' },
  },
];
