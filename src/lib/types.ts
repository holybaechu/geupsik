export interface OptimizedSchool {
    officeCode: string;
    schoolCode: string;
    schoolName: string;
}

export interface OptimizedMeal {
    id: string;
    schoolName: string;
    date: string;
    type: string;
    dishes: string;
    calories: string;
    nutrients: string;
    votes: number;
    comments: number;
}
