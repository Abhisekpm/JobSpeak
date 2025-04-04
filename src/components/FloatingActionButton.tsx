import React, { useState } from "react";
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
}

const FloatingActionButton = ({
  onFabClick = () => console.log("FAB clicked"),
  className,
}: FloatingActionButtonProps) => {
  const handleFabClick = () => {
    onFabClick();
  };

  return (
    <div className={cn("fixed bottom-8 right-8 z-50", className)}>
      <motion.button
        onClick={handleFabClick}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        whileTap={{ scale: 0.95 }}
      >
        <Plus size={24} />
      </motion.button>
    </div>
  );
};

export default FloatingActionButton;
