import InstagramLogo from "../assets/instagram-logo.svg";
import PinterestLogo from "../assets/pinterest-logo.svg";
import SettingsIcon from '@mui/icons-material/Settings';
import DashboardIcon from '@mui/icons-material/Dashboard';

export type SectionKey = "settings" | "projects" | "instagram" | "pinterest";

interface SidebarProps {
  selected: SectionKey;
  onSelect: (section: SectionKey) => void;
}

export default function Sidebar({ selected, onSelect }: SidebarProps) {
  return (
    <aside
      style={{
        width: 80,
        flex: "0 0 80px",
        flexShrink: 0,
        borderRight: "1px solid #2a2a2a",
        padding: "16px 8px",
        position: "sticky",
        top: 0,
        height: "100vh",
        boxSizing: "border-box",
        alignSelf: "flex-start",
      }}
    >
      <nav style={{ display: "grid", gap: 12, justifyItems: "center" }}>
        <SidebarButton
          icon={<SettingsIcon/>}
          active={selected === "settings"}
          onClick={() => onSelect("settings")}
        />
        <SidebarButton
          icon={<DashboardIcon/>}
          active={selected === "projects"}
          onClick={() => onSelect("projects")}
        />
        <SidebarButton
          icon={<img src={InstagramLogo} style={{ width: 24, height: 24 }} />}
          active={selected === "instagram"}
          onClick={() => onSelect("instagram")}
        />
        <SidebarButton
          icon={<img src={PinterestLogo} style={{ width: 24, height: 24 }} />}
          active={selected === "pinterest"}
          onClick={() => onSelect("pinterest")}
        />
      </nav>
    </aside>
  );
}

function SidebarButton({
  icon,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "center",
        background: active ? "#2a2a2a" : "#1a1a1a",
        color: active ? "#fff" : "#ddd",
        padding: "12px",
        borderRadius: 12,
        width: 48,
        height: 48,
        fontSize: "20px",
        border: active ? "1px solid #646cff" : "1px solid #333",
      }}
    >
      {icon}
    </button>
  );
}


