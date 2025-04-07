import React, { useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "./ui/dropdown-menu";
import {
  Search,
  Filter,
  Calendar,
} from "lucide-react";

interface SearchFilterProps {
  onSearchChange: (term: string) => void;
  onFilter: (filters: FilterOptions) => void;
}

interface FilterOptions {
  date?: string[];
}

interface FiltersState {
  date: Record<string, boolean>;
}

const SearchFilter: React.FC<SearchFilterProps> = ({
  onSearchChange,
  onFilter,
}) => {
  const dateOptions = ["Today", "This Week", "This Month", "This Year"];

  const [filters, setFilters] = useState<FiltersState>({
    date: {
      "Today": false,
      "This Week": false,
      "This Month": false,
      "This Year": false
    }
  });

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    onSearchChange(query);
  };

  const handleDateFilter = (dateKey: string) => {
    const newFilters = {
      ...filters,
      date: { 
          ...filters.date,
          [dateKey]: !filters.date[dateKey]
      }
    };
    setFilters(newFilters);
    triggerFilterCallback(newFilters);
  };

  const triggerFilterCallback = (currentFilters: FiltersState) => {
    const activeFilters: FilterOptions = {};
    
    const selectedDates = Object.entries(currentFilters.date)
        .filter(([_, isSelected]) => isSelected)
        .map(([key, _]) => key);
        
    if (selectedDates.length > 0) {
      activeFilters.date = selectedDates;
    }

    onFilter(activeFilters);
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-2 w-full bg-white p-2 rounded-lg shadow-sm">
      <div className="relative flex-grow">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search conversations by name or content..."
          className="w-full rounded-lg bg-background pl-9 pr-4 py-2 text-sm border-gray-300 focus:border-primary focus:ring-primary"
          onChange={handleInputChange}
        />
      </div>

      <div className="flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
            >
              <Filter className="h-4 w-4" />
              <span>Filter</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Date</DropdownMenuLabel>
            {dateOptions.map((date) => (
              <DropdownMenuCheckboxItem
                key={date}
                checked={filters.date[date]}
                onCheckedChange={() => handleDateFilter(date)}
              >
                <div className="flex items-center gap-2">
                   <Calendar className="h-4 w-4" />
                   <span>{date}</span>
                </div>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default SearchFilter;
