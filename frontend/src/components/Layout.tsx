import React from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header"; // Added import back

const Layout: React.FC = () => {
  return (
    <div>
      <Header /> {/* Added Header back */} 
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
