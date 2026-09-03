import React from "react"

import { IconProps } from "types/icon"
import { palette } from "styles/palette.generated"

const Bookmark: React.FC<IconProps> = ({
  size = "21",
  color = palette.olive15,
  ...attributes
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 21 21"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...attributes}
    >
      <path
        d="M7.25687 17.8929C6.70187 18.2537 5.98438 17.8354 5.98438 17.1521V3.81039C5.98438 3.37706 6.26437 3.02539 6.60937 3.02539H15.3594C15.7044 3.02539 15.9844 3.37706 15.9844 3.81039V17.1521C15.9844 17.8354 15.2669 18.2537 14.7119 17.8937L11.4235 15.7587C11.2931 15.6731 11.1404 15.6274 10.9844 15.6274C10.8283 15.6274 10.6757 15.6731 10.5452 15.7587L7.25687 17.8929Z"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default Bookmark