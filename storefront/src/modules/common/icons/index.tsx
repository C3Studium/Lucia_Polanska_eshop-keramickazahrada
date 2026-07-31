import {
  Adjustments,
  ArrowPath,
  ArrowRightOnRectangle,
  ArrowUpMini,
  ArrowUturnLeft,
  BarsThree,
  ChatBubbleLeftRight,
  ChevronDown,
  CogSixTooth,
  Facebook,
  FlyingBox,
  MagnifyingGlass,
  MapPin,
  Medusa,
  NextJs,
  Plus,
  TruckFast,
  User,
  UserMini,
  XMark,
} from "@medusajs/icons"

import type { IconProps } from "types/icon"

export {
  Adjustments as Options,
  ArrowPath as Refresh,
  ArrowRightOnRectangle as LogoutIcon,
  ArrowUpMini as ArrowUp,
  ArrowUturnLeft as Back,
  BarsThree as WheelIcon,
  ChatBubbleLeftRight as ReviewsIcon,
  ChevronDown,
  CogSixTooth as SettingsIcon,
  Facebook,
  FlyingBox as Package,
  MagnifyingGlass as SearchIcon,
  MapPin,
  Medusa,
  NextJs,
  Plus,
  TruckFast as FastDelivery,
  User,
  UserMini as UserIcon,
  XMark as Close,
}

export const Instagram = ({
  size = 24,
  color = "currentColor",
  ...attributes
}: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...attributes}
  >
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="5"
      stroke={color}
      strokeWidth="1.5"
    />
    <circle cx="12" cy="12" r="4" stroke={color} strokeWidth="1.5" />
    <circle cx="17.5" cy="6.5" r="1" fill={color} />
  </svg>
)
