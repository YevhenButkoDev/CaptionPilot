import * as React from "react";
import InstagramSidebar, { type InstagramSectionKey } from "./InstagramSidebar";
import DraggableImageList from "./InstagramLikeGrid";
import AutoPosts from "./AutoPosts";
import { Box } from "@mui/material";

export default function InstagramContainer() {
  const [instagramSection, setInstagramSection] = React.useState<InstagramSectionKey>("feed");

  return (
    <div style={{ display: "flex", width: "100%" }}>
      <InstagramSidebar 
        selected={instagramSection} 
        onSelect={setInstagramSection} 
      />
      <Box sx={{ flex: 1, p: 2 }}>
        {instagramSection === "feed" && <DraggableImageList />}
        {instagramSection === "generator" && <AutoPosts />}
      </Box>
    </div>
  );
}
