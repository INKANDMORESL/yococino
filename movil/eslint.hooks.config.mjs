// Solo comprueba las reglas de los hooks de React (useState, useEffect… siempre antes de cualquier «return»).
// Un hook después de un «return» cierra la app en el móvil. Lo ejecuta GitHub en «Comprobar app».
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['node_modules/**', 'dist/**', '.expo/**'] },
  {
    files: ['app/**/*.tsx', 'src/**/*.tsx', 'src/**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    plugins: { 'react-hooks': reactHooks },
    rules: { 'react-hooks/rules-of-hooks': 'error' },
  },
];
