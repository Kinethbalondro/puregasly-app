// Same rule the server enforces: 8+ characters with at least one letter and one number.
export function isStrongPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8 && pw.length <= 128 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

export const PASSWORD_RULE_MESSAGE = 'Password must be at least 8 characters and include a letter and a number.';
