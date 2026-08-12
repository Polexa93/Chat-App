// Minimum bar: 8+ characters, at least one letter and one number.
// (Deliberately not requiring symbols/mixed-case - keeps it usable while
// meaningfully raising the bar above the old "6 characters, anything goes".)
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export const getPasswordError = (password: string): string | null => {
  if (!password || typeof password !== 'string') {
    return 'Password is required';
  }
  if (!PASSWORD_PATTERN.test(password)) {
    return 'Password must be at least 8 characters and include a letter and a number';
  }
  return null;
};
