import React, { useState, ReactNode } from "react";
import { Plus, Mic, Upload, Play, Pause, Square } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps {
  onFabClick?: () => void;
  className?: string;
  children?: ReactNode;
}

const FloatingActionButton = ({
  onFabClick = () => console.log("FAB clicked"),
  className,
  children,
}: FloatingActionButtonProps) => {
  const handleFabClick = () => {
    onFabClick();
  };

  const buttonClasses = children
    ? "flex h-auto w-auto items-center justify-center rounded-full px-6 py-3 bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    : "flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

  return (
    <div className={cn("fixed bottom-8 right-8 z-50", className)}>
      <motion.button
        onClick={handleFabClick}
        className={buttonClasses}
        whileTap={{ scale: 0.95 }}
      >
        {children ? children : <Plus size={24} />}
      </motion.button>
    </div>
  );
};

export default FloatingActionButton;
