import React, { useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "./ui/dropdown-menu";
import {
  Search,
  Filter,
  Calendar,
  Clock,
  SortDesc,
  SortAsc,
} from "lucide-react";

interface SearchFilterProps {
  onSearch?: (query: string) => void;
  onFilter?: (filters: FilterOptions) => void;
  onSort?: (sortOption: SortOption) => void;
}

interface FilterOptions {
  date: string[];
  duration: string[];
}

type SortOption = "newest" | "oldest" | "longest" | "shortest" | "alphabetical";

const SearchFilter = ({
  onSearch = () => {},
  onFilter = () => {},
  onSort = () => {},
}: SearchFilterProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterOptions>({
    date: [],
    duration: [],
  });
  const [sortOption, setSortOption] = useState<SortOption>("newest");

  // Date filter options
  const dateOptions = ["Today", "This Week", "This Month", "This Year"];

  // Duration filter options
  const durationOptions = ["< 5 min", "5-15 min", "15-30 min", "> 30 min"];

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch(query);
  };

  const handleDateFilter = (date: string) => {
    setFilters((prev) => {
      const newDateFilters = prev.date.includes(date)
        ? prev.date.filter((d) => d !== date)
        : [...prev.date, date];

      const newFilters = { ...prev, date: newDateFilters };
      onFilter(newFilters);
      return newFilters;
    });
  };

  const handleDurationFilter = (duration: string) => {
    setFilters((prev) => {
      const newDurationFilters = prev.duration.includes(duration)
        ? prev.duration.filter((d) => d !== duration)
        : [...prev.duration, duration];

      const newFilters = { ...prev, duration: newDurationFilters };
      onFilter(newFilters);
      return newFilters;
    });
  };

  const handleSort = (option: SortOption) => {
    setSortOption(option);
    onSort(option);
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-2 w-full bg-white p-2 rounded-lg shadow-sm">
      <div className="relative flex-grow">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={handleSearch}
          className="pl-9 w-full"
        />
      </div>

      <div className="flex gap-2">
        {/* Filter Dropdown */}
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
                checked={filters.date.includes(date)}
                onCheckedChange={() => handleDateFilter(date)}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{date}</span>
                </div>
              </DropdownMenuCheckboxItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuLabel>Duration</DropdownMenuLabel>
            {durationOptions.map((duration) => (
              <DropdownMenuCheckboxItem
                key={duration}
                checked={filters.duration.includes(duration)}
                onCheckedChange={() => handleDurationFilter(duration)}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{duration}</span>
                </div>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
            >
              {sortOption === "newest" ||
              sortOption === "longest" ||
              sortOption === "alphabetical" ? (
                <SortDesc className="h-4 w-4" />
              ) : (
                <SortAsc className="h-4 w-4" />
              )}
              <span>Sort</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuItem onClick={() => handleSort("newest")}>
              <div className="flex items-center gap-2">
                <SortDesc className="h-4 w-4" />
                <span>Newest First</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("oldest")}>
              <div className="flex items-center gap-2">
                <SortAsc className="h-4 w-4" />
                <span>Oldest First</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleSort("longest")}>
              <div className="flex items-center gap-2">
                <SortDesc className="h-4 w-4" />
                <span>Longest First</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("shortest")}>
              <div className="flex items-center gap-2">
                <SortAsc className="h-4 w-4" />
                <span>Shortest First</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleSort("alphabetical")}>
              <div className="flex items-center gap-2">
                <SortDesc className="h-4 w-4" />
                <span>Alphabetical (A-Z)</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default SearchFilter;
