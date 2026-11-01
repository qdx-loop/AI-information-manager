/**
 * Lucide 图标适配层（Nova Editorial）
 *
 * 图标规范：全站统一 Lucide（1.8px 线宽，16/18/20 尺寸）。
 * 历史代码里图标以 Ant Design 命名引用；这里提供同名轻量包装，
 * 避免逐文件重写 JSX、同时保证线宽与视觉一致——不改变任何交互。
 */
import type { CSSProperties, MouseEventHandler } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  BookOpen, LayoutGrid, ArrowLeft, ArrowRight, Car, CircleCheck, Check,
  SquareCheck, X, Cloud, CloudCog, Copy, Database, Trash2, ChevronDown,
  Download, Pencil, FileUp, FileDown, FileText, Globe, Heart, History,
  GripVertical, Home, IdCard, Inbox, Info, KeyRound, Link, Mail, Pill,
  MessageSquare, Moon, MoreHorizontal, Paperclip, Phone, Image, Plus,
  CircleHelp, RefreshCw, ChevronRight, Bot, Undo2, BadgeCheck, ShieldCheck,
  Save, Search, Send, Settings, Star, Ban, Sun, ArrowLeftRight, Users,
  Upload, TriangleAlert,
} from 'lucide-react'

export interface AntIconProps {
  size?: number
  className?: string
  style?: CSSProperties
  spin?: boolean
  rotate?: number
  color?: string
  title?: string
  onClick?: MouseEventHandler<SVGSVGElement>
  'aria-label'?: string
  'aria-hidden'?: boolean
}

function make(Icon: LucideIcon, defaultSize = 16) {
  return function NovaIcon({
    size = defaultSize,
    spin,
    rotate,
    color,
    className,
    style,
    title,
    onClick,
    'aria-label': ariaLabel,
    'aria-hidden': ariaHidden = true,
  }: AntIconProps) {
    return (
      <Icon
        size={size}
        strokeWidth={1.8}
        color={color}
        className={[className, spin ? 'icon-spin' : ''].filter(Boolean).join(' ') || undefined}
        style={{ ...style, ...(rotate ? { transform: `rotate(${rotate}deg)` } : {}) }}
        onClick={onClick}
        aria-label={title ?? ariaLabel}
        aria-hidden={ariaHidden}
      />
    )
  }
}

export const AccountBookOutlined = make(BookOpen)
export const AppstoreOutlined = make(LayoutGrid)
export const ArrowLeftOutlined = make(ArrowLeft)
export const ArrowRightOutlined = make(ArrowRight)
export const CarOutlined = make(Car)
export const CheckCircleOutlined = make(CircleCheck)
export const CheckOutlined = make(Check)
export const CheckSquareOutlined = make(SquareCheck)
export const CloseOutlined = make(X)
export const CloudOutlined = make(Cloud)
export const CloudSyncOutlined = make(CloudCog)
export const CopyOutlined = make(Copy)
export const DatabaseOutlined = make(Database)
export const DeleteOutlined = make(Trash2)
export const DownOutlined = make(ChevronDown)
export const DownloadOutlined = make(Download)
export const EditOutlined = make(Pencil)
export const ExportOutlined = make(FileUp)
export const FileTextOutlined = make(FileText)
export const GlobalOutlined = make(Globe)
export const HeartOutlined = make(Heart)
export const HistoryOutlined = make(History)
export const HolderOutlined = make(GripVertical)
export const HomeOutlined = make(Home)
export const IdcardOutlined = make(IdCard)
export const ImportOutlined = make(FileDown)
export const InboxOutlined = make(Inbox)
export const InfoCircleOutlined = make(Info)
export const KeyOutlined = make(KeyRound)
export const LinkOutlined = make(Link)
export const MailOutlined = make(Mail)
export const MedicineBoxOutlined = make(Pill)
export const MessageOutlined = make(MessageSquare)
export const MoonOutlined = make(Moon)
export const MoreOutlined = make(MoreHorizontal)
export const PaperClipOutlined = make(Paperclip)
export const PhoneOutlined = make(Phone)
export const PictureOutlined = make(Image)
export const PlusOutlined = make(Plus)
export const QuestionCircleOutlined = make(CircleHelp)
export const ReloadOutlined = make(RefreshCw)
export const RightOutlined = make(ChevronRight)
export const RobotOutlined = make(Bot)
export const RollbackOutlined = make(Undo2)
export const SafetyCertificateOutlined = make(BadgeCheck)
export const SafetyOutlined = make(ShieldCheck)
export const SaveOutlined = make(Save)
export const SearchOutlined = make(Search)
export const SendOutlined = make(Send)
export const SettingOutlined = make(Settings)
export const StarOutlined = make(Star)
export const StopOutlined = make(Ban)
export const SunOutlined = make(Sun)
export const SwapOutlined = make(ArrowLeftRight)
export const SyncOutlined = make(RefreshCw)
export const TeamOutlined = make(Users)
export const UndoOutlined = make(Undo2)
export const UploadOutlined = make(Upload)
export const WarningOutlined = make(TriangleAlert)
