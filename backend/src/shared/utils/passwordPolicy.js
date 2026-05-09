export function assertStrongPassword(password) {
  const value = String(password || "");
  const hasMinLength = value.length >= 10;
  const hasUppercase = /[A-Z]/.test(value);
  const hasLowercase = /[a-z]/.test(value);
  const hasNumber = /\d/.test(value);

  if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber) {
    throw new Error(
      "Senha fraca. Use ao menos 10 caracteres com letras maiusculas, minusculas e numeros"
    );
  }
}
