export type DecisionCategory =
    | 'confirmed'
    | 'pending'
    | 'preference'
    | 'risk'
    | 'next';

export interface DecisionItem {
    id: string;
    category: DecisionCategory;
    content: string;
}