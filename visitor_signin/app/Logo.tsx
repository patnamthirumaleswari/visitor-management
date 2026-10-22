// The company logo, or the company's initials in its brand colour when no logo is uploaded.
// No hooks, so it works in both server and client components.

type Props = { logo: string | null; companyName: string; color: string; textColor: string; size?: number };

export default function Logo({ logo, companyName, color, textColor, size = 48 }: Props) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="logo" src={logo} alt={`${companyName} logo`} style={{ height: size, maxWidth: size * 4 }} />;
  }
  const initials = companyName
    .split(/\s+/)
    .filter((w) => /^[A-Za-z0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <span
      className="logo logo-initials"
      role="img"
      aria-label={`${companyName} logo`}
      style={{ width: size, height: size, background: color, color: textColor, fontSize: size * 0.42 }}
    >
      {initials || "?"}
    </span>
  );
}
