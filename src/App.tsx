import './App.css'
import DraggableImageList from "./components/InstagramLikeGrid.tsx";
import Sidebar, { type SectionKey } from "./components/Sidebar.tsx";
import ProjectsGrid from "./components/ProjectsGrid.tsx";
import ProjectDetailPage from "./components/ProjectDetailPage.tsx";
import * as React from "react";

function App() {
  const [section, setSection] = React.useState<SectionKey>("instagram");
  const [currentProjectId, setCurrentProjectId] = React.useState<string | null>(null);

  // Handle hash-based navigation for projects
  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#project/')) {
        const projectId = hash.substring(9); // Remove '#project/' prefix
        setCurrentProjectId(projectId);
        setSection("projects");
      } else {
        setCurrentProjectId(null);
      }
    };

    // Check initial hash
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleBackToProjects = () => {
    setCurrentProjectId(null);
    window.location.hash = '';
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", height: "100vh", overflow: "hidden" }}>
      <Sidebar selected={section} onSelect={setSection} />
      <main style={{
        flex: 1,
        padding: 16,
        overflow: "auto",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
      }}>
        {section === "instagram" && <DraggableImageList />}
        {section === "projects" && currentProjectId ? (
          <ProjectDetailPage 
            projectId={currentProjectId} 
            onBack={handleBackToProjects} 
          />
        ) : section === "projects" && (
          <ProjectsGrid />
        )}
        {section === "settings" && (
          <div style={{ maxWidth: 960, width: "100%" }}>
            <h2>Settings</h2>
            <p>Mock settings content goes here.</p>
          </div>
        )}
        {section === "pinterest" && (
          <div style={{ maxWidth: 960, width: "100%" }}>
            <h2>Pinterest</h2>
            <p>Mock Pinterest content goes here.</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
