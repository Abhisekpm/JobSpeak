import React from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header"; // Ensure this is the original header

const Layout: React.FC = () => {
  return (
    <div>
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
