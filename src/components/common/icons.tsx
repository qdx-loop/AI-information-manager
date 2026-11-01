/**
 * Fluent System Icons 适配层（Windows 11 / Fluent UI React v9）
 *
 * 规范：官方 `@fluentui/react-icons`（Segoe Fluent Icons 语义、Regular 线型）。
 * 历史代码以 Ant Design 命名引用图标；这里做同名映射，保证 18 个业务文件
 * 无需重写 JSX 就能统一到 Fluent 图标，同时保留 size/spin/rotate/onClick 语义。
 */
import type { CSSProperties, MouseEventHandler } from 'react'
import {
  BookRegular, GridRegular, ArrowLeftRegular, ArrowRightRegular, VehicleCarRegular,
  CheckmarkCircleRegular, CheckmarkRegular, CheckboxCheckedRegular, CheckmarkSquareRegular,
  DismissRegular, CloudRegular, CloudSyncRegular, CopyRegular, DatabaseRegular,
  DeleteRegular, ChevronDownRegular, ArrowDownloadRegular, EditRegular, ArrowExportUpRegular,
  DocumentRegular, GlobeRegular, HeartRegular, HistoryRegular, ReOrderDotsVerticalRegular,
  HomeRegular, ContactCardRegular, ArrowImportRegular, MailInboxRegular, InfoRegular,
  KeyRegular, LinkRegular, MailRegular, PillRegular, ChatRegular, WeatherMoonRegular,
  MoreHorizontalRegular, AttachRegular, PhoneRegular, ImageRegular, AddRegular,
  QuestionCircleRegular, ArrowClockwiseRegular, ChevronRightRegular, BotRegular,
  ArrowUndoRegular, ShieldCheckmarkRegular, ShieldRegular, SaveRegular, SearchRegular,
  SendRegular, SettingsRegular, StarRegular, ProhibitedRegular, WeatherSunnyRegular,
  ArrowSwapRegular, ArrowSyncRegular, PeopleRegular, ArrowUploadRegular, WarningRegular,
} from '@fluentui/react-icons'
import type { FluentIcon } from '@fluentui/react-icons'

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

function make(Icon: FluentIcon, defaultSize = 16) {
  return function FluentIcon({
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
        fontSize={size}
        className={[className, spin ? 'icon-spin' : ''].filter(Boolean).join(' ') || undefined}
        style={{ ...style, ...(color ? { color } : {}), ...(rotate ? { transform: `rotate(${rotate}deg)` } : {}) }}
        onClick={onClick}
        aria-label={title ?? ariaLabel}
        aria-hidden={ariaHidden}
      />
    )
  }
}

export const AccountBookOutlined = make(BookRegular)
export const AppstoreOutlined = make(GridRegular)
export const ArrowLeftOutlined = make(ArrowLeftRegular)
export const ArrowRightOutlined = make(ArrowRightRegular)
export const CarOutlined = make(VehicleCarRegular)
export const CheckCircleOutlined = make(CheckmarkCircleRegular)
export const CheckOutlined = make(CheckmarkRegular)
export const CheckSquareOutlined = make(CheckboxCheckedRegular)
export const CloseOutlined = make(DismissRegular)
export const CloudOutlined = make(CloudRegular)
export const CloudSyncOutlined = make(CloudSyncRegular)
export const CopyOutlined = make(CopyRegular)
export const DatabaseOutlined = make(DatabaseRegular)
export const DeleteOutlined = make(DeleteRegular)
export const DownOutlined = make(ChevronDownRegular)
export const DownloadOutlined = make(ArrowDownloadRegular)
export const EditOutlined = make(EditRegular)
export const ExportOutlined = make(ArrowExportUpRegular)
export const FileTextOutlined = make(DocumentRegular)
export const GlobalOutlined = make(GlobeRegular)
export const HeartOutlined = make(HeartRegular)
export const HistoryOutlined = make(HistoryRegular)
export const HolderOutlined = make(ReOrderDotsVerticalRegular)
export const HomeOutlined = make(HomeRegular)
export const IdcardOutlined = make(ContactCardRegular)
export const ImportOutlined = make(ArrowImportRegular)
export const InboxOutlined = make(MailInboxRegular)
export const InfoCircleOutlined = make(InfoRegular)
export const KeyOutlined = make(KeyRegular)
export const LinkOutlined = make(LinkRegular)
export const MailOutlined = make(MailRegular)
export const MedicineBoxOutlined = make(PillRegular)
export const MessageOutlined = make(ChatRegular)
export const MoonOutlined = make(WeatherMoonRegular)
export const MoreOutlined = make(MoreHorizontalRegular)
export const PaperClipOutlined = make(AttachRegular)
export const PhoneOutlined = make(PhoneRegular)
export const PictureOutlined = make(ImageRegular)
export const PlusOutlined = make(AddRegular)
export const QuestionCircleOutlined = make(QuestionCircleRegular)
export const ReloadOutlined = make(ArrowClockwiseRegular)
export const RightOutlined = make(ChevronRightRegular)
export const RobotOutlined = make(BotRegular)
export const RollbackOutlined = make(ArrowUndoRegular)
export const SafetyCertificateOutlined = make(ShieldCheckmarkRegular)
export const SafetyOutlined = make(ShieldRegular)
export const SaveOutlined = make(SaveRegular)
export const SearchOutlined = make(SearchRegular)
export const SendOutlined = make(SendRegular)
export const SettingOutlined = make(SettingsRegular)
export const StarOutlined = make(StarRegular)
export const StopOutlined = make(ProhibitedRegular)
export const SunOutlined = make(WeatherSunnyRegular)
export const SwapOutlined = make(ArrowSwapRegular)
export const SyncOutlined = make(ArrowSyncRegular)
export const TeamOutlined = make(PeopleRegular)
export const UndoOutlined = make(ArrowUndoRegular)
export const UploadOutlined = make(ArrowUploadRegular)
export const WarningOutlined = make(WarningRegular)
export { CheckmarkSquareRegular }
