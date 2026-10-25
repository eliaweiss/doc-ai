interface LogoIconProps {
  size?: number
  className?: string
  fill: string
  style?: React.CSSProperties
}

export default function LogoIcon({ size = 34, className = '', fill, style }: LogoIconProps) {
  return (
    <div className={`flex items-center rounded-l-[4px] overflow-hidden ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={style}
      >
        <rect
          width="32"
          height="32"
          fill={fill}
          stroke="rgba(241, 240, 224, 0.1)"
          strokeWidth="1"
        />
        <text
          x="16"
          y="22"
          fontFamily="Arial, sans-serif"
          fontSize="16"
          fontWeight="bold"
          fill="currentColor"
          textAnchor="middle"
        >
          1F
        </text>
      </svg>
    </div>
  )
}
