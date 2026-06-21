interface Props {
  size?: number
}

export default function WKLogo({ size = 28 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16 3C11.029 3 7 7.029 7 12c0 6.5 9 17 9 17s9-10.5 9-17c0-4.971-4.029-9-9-9z"
        fill="#FF6A3D"
      />
      <circle cx="16" cy="12" r="3.4" fill="#16181f" />
    </svg>
  )
}
