interface Props {
  firstName: string;
  lastName: string;
  avatarDataUrl?: string;
  size?: number;
  onClick?: () => void;
}

function stringToColor(s: string): string {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return `hsl(${h % 360}, 60%, 45%)`;
}

export function Avatar({ firstName, lastName, avatarDataUrl, size = 36, onClick }: Props) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const bgColor = stringToColor(firstName + lastName);

  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    cursor: onClick ? "pointer" : undefined,
    flexShrink: 0,
  };

  if (avatarDataUrl) {
    return (
      <img
        src={avatarDataUrl}
        alt={`${firstName} ${lastName}`}
        style={style}
        onClick={onClick}
        className="object-cover"
      />
    );
  }

  return (
    <div
      style={{ ...style, background: bgColor, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClick}
    >
      <span style={{ color: "#fff", fontSize: size * 0.38, fontWeight: 700, lineHeight: 1 }}>
        {initials}
      </span>
    </div>
  );
}
