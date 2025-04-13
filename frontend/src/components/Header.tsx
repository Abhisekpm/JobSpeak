import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { User, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const Header: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSettings = () => {
    navigate('/settings');
  };

  const getInitials = (name: string | undefined): string => {
      if (!name) return "?";
      return name
          .split(" ")
          .map((n) => n[0])
          .filter((_, i, arr) => i === 0 || i === arr.length - 1)
          .join("")
          .toUpperCase();
  };

  return (
    <header className="bg-white border-b border-gray-200 py-2 sticky top-0 z-20">
      <div className="container mx-auto px-4 flex justify-between items-center h-14">
        <Link to="/" className="flex items-center">
          <img 
            src="/jobspeak_logo.png"
            alt="JobSpeak Logo" 
            className="h-10 w-auto"
          />
        </Link>
        <div>
          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {getInitials(user.username)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex flex-col space-y-1 p-2">
                  <p className="text-sm font-medium leading-none">{user.username}</p>
                  {user.email && (
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSettings} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            !isAuthenticated && (
                <Link to="/login" className="text-blue-600 hover:underline">
                    Login
                </Link>
            )
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
