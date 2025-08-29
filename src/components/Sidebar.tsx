import InstagramLogo from "../assets/instagram-logo.svg";
import PinterestLogo from "../assets/pinterest-logo.svg";
import SettingsIcon from '@mui/icons-material/Settings';
import DashboardIcon from '@mui/icons-material/Dashboard';
import Logo from './Logo';
import { Box } from '@mui/material';

export type SectionKey = "dashboard" | "settings" | "projects" | "instagram" | "pinterest";

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
      <nav style={{ display: "grid", gap: 16, justifyItems: "center" }}>
        {/* Logo at the top - clickable for dashboard */}
        <Box sx={{ mb: 3, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <button
            onClick={() => onSelect("dashboard")}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "8px 4px",
              borderRadius: 8,
              width: "100%",
            }}
          >
            <Logo />
          </button>
        </Box>
        
        <SidebarButton
          icon={<SettingsIcon/>}
          label="Settings"
          active={selected === "settings"}
          onClick={() => onSelect("settings")}
        />
        <SidebarButton
          icon={<DashboardIcon/>}
          label="Projects"
          active={selected === "projects"}
          onClick={() => onSelect("projects")}
        />
        <SidebarButton
          icon={<img src={InstagramLogo} style={{ width: 24, height: 24 }} />}
          label="Instagram"
          active={selected === "instagram"}
          onClick={() => onSelect("instagram")}
        />
        <SidebarButton
          icon={<img src={PinterestLogo} style={{ width: 24, height: 24 }} />}
          label="Pinterest"
          active={selected === "pinterest"}
          onClick={() => onSelect("pinterest")}
        />
      </nav>
    </aside>
  );
}

function SidebarButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        background: active ? "rgba(255, 255, 255, 0.1)" : "transparent",
        color: active ? "#fff" : "#ddd",
        padding: "8px 4px",
        borderRadius: 8,
        width: "100%",
        fontSize: "10px",
        border: active ? "1px solid rgba(255, 255, 255, 0.3)" : "1px solid transparent",
        cursor: "pointer",
        transition: "all 0.2s ease",
        textAlign: "center",
        position: "relative",
      }}
    >
      {active && (
        <div
          style={{
            position: "absolute",
            left: -8,
            top: "50%",
            transform: "translateY(-50%)",
            width: 3,
            height: 24,
            background: "#fff",
            borderRadius: "0 2px 2px 0",
          }}
        />
      )}
      <span style={{ fontSize: "24px" }}>{icon}</span>
      <span style={{ 
        fontWeight: active ? "600" : "400",
        lineHeight: "1.2"
      }}>
        {label}
      </span>
    </button>
  );
}


