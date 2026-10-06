/** Strong-password rule for staff (no 2FA yet, so the password carries the weight). */
export function passwordProblems(password: string, email?: string): string[] {
  const problems: string[] = [];
  if (password.length < 12) problems.push("at least 12 characters");
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) problems.push("at least three of: lowercase, uppercase, number, symbol");
  if (email && password.toLowerCase().includes(email.split("@")[0].toLowerCase())) problems.push("must not contain your email name");
  if (/^(password|kvstorage|kvselfstorage|qwerty|123456)/i.test(password)) problems.push("too common");
  return problems;
}
