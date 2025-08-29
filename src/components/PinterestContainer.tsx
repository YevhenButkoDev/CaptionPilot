import * as React from "react";
import PinterestSidebar, { type PinterestSectionKey } from "./PinterestSidebar";
import PinterestFeed from "./PinterestFeed";
import PinterestPostGenerator from "./PinterestPostGenerator";
import Scheduler from "./Scheduler"; // Reuse the same scheduler component
import { Box } from "@mui/material";

export default function PinterestContainer() {
  const [pinterestSection, setPinterestSection] = React.useState<PinterestSectionKey>("feed");

  return (
    <div style={{ display: "flex", width: "100%" }}>
      <PinterestSidebar 
        selected={pinterestSection} 
        onSelect={setPinterestSection} 
      />
      <Box sx={{ flex: 1, p: 2 }}>
        {pinterestSection === "feed" && <PinterestFeed />}
        {pinterestSection === "generator" && <PinterestPostGenerator />}
        {pinterestSection === "scheduler" && <Scheduler />}
      </Box>
    </div>
  );
}
