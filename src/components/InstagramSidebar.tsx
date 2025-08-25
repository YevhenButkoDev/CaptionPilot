import * as React from "react";
import { Box } from "@mui/material";

export type InstagramSectionKey = "feed" | "generator";

interface InstagramSidebarProps {
  selected: InstagramSectionKey;
  onSelect: (section: InstagramSectionKey) => void;
}

export default function InstagramSidebar({ selected, onSelect }: InstagramSidebarProps) {
  return (
    <aside
      style={{
        width: 200,
        flex: "0 0 200px",
        flexShrink: 0,
        borderRight: "1px solid #2a2a2a",
        padding: "16px",
        position: "sticky",
        top: 0,
        height: "100vh",
        boxSizing: "border-box",
        alignSelf: "flex-start",
        backgroundColor: "#1a1a1a",
        marginLeft: 0,
      }}
    >
      <nav style={{ display: "grid", gap: 12 }}>
        <InstagramSidebarButton
          label="Feed"
          active={selected === "feed"}
          onClick={() => onSelect("feed")}
        />
        <InstagramSidebarButton
          label="Generator"
          active={selected === "generator"}
          onClick={() => onSelect("generator")}
        />
      </nav>
    </aside>
  );
}

function InstagramSidebarButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        background: active ? "#2a2a2a" : "transparent",
        color: active ? "#fff" : "#ddd",
        padding: "16px 20px",
        borderRadius: 8,
        width: "100%",
        fontSize: "14px",
        fontWeight: active ? "600" : "400",
        border: "1px solid #333",
        cursor: "pointer",
        transition: "all 0.2s ease",
        minHeight: "48px",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "#2a2a2a";
          e.currentTarget.style.color = "#fff";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "#ddd";
        }
      }}
    >
      {label}
    </button>
  );
}
