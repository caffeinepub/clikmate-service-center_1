import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export class ExternalBlob {
    getBytes(): Promise<Uint8Array<ArrayBuffer>>;
    getDirectURL(): string;
    static fromURL(url: string): ExternalBlob;
    static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob;
    withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob;
}
export interface TypesettingQuoteUpdate {
    status: string;
}
export interface PosSale {
    id: bigint;
    paymentMethod: string;
    customerPhone: string;
    staffMobile: string;
    createdAt: bigint;
    totalAmount: number;
    items: Array<PosSaleItem>;
}
export interface ShopOrderItem {
    qty: bigint;
    itemId: bigint;
    itemName: string;
    price: number;
}
export interface CatalogItem {
    id: bigint;
    requiredDocuments: string;
    stockStatus: string;
    requiresPdfCalc: boolean;
    published: boolean;
    name: string;
    createdAt: bigint;
    description: string;
    category: string;
    price: string;
    mediaFiles: Array<ExternalBlob>;
    mediaTypes: Array<string>;
}
export interface ExpenseEntry {
    id: bigint;
    date: string;
    note: string;
    createdAt: bigint;
    addedBy: string;
    paymentMode: string;
    category: string;
    amount: number;
}
export interface Review {
    id: bigint;
    customerName: string;
    deliveryRating?: bigint;
    customerPhone: string;
    serviceRating: bigint;
    published: boolean;
    createdAt: bigint;
    orderId: bigint;
    location: string;
    deliveryComment?: string;
    serviceComment: string;
}
export interface ManualIncomeEntry {
    id: bigint;
    date: string;
    createdAt: bigint;
    description: string;
    paymentMode: string;
    category: string;
    amount: number;
}
export interface CatalogItemInput {
    requiredDocuments: string;
    stockStatus: string;
    requiresPdfCalc: boolean;
    name: string;
    description: string;
    category: string;
    price: string;
    mediaFiles: Array<ExternalBlob>;
    mediaTypes: Array<string>;
}
export interface KhataEntry {
    customerName: string;
    lastUpdated: bigint;
    totalDue: number;
    phone: string;
}
export interface MaskedShopOrder {
    id: bigint;
    customerName: string;
    status: string;
    deliveryAddress: string;
    paymentMethod: string;
    createdAt: bigint;
    deliveryMethod: string;
    totalAmount: number;
    phone: string;
    items: Array<ShopOrderItem>;
}
export interface ShopOrder {
    id: bigint;
    customerName: string;
    status: string;
    deliveryAddress: string;
    paymentMethod: string;
    deliveryOtp: string;
    cscFinalOutput?: ExternalBlob;
    createdAt: bigint;
    deliveryMethod: string;
    cscDocuments: Array<ExternalBlob>;
    cscSpecialDetails: string;
    totalAmount: number;
    phone: string;
    items: Array<ShopOrderItem>;
}
export interface SupportTicket {
    id: bigint;
    resolved: boolean;
    createdAt: bigint;
    complaint: string;
    customerMobile: string;
    orderId: string;
}
export interface OrderRecord {
    id: bigint;
    status: string;
    serviceType: string;
    name: string;
    submittedAt: bigint;
    instructions: string;
    uploadedFiles: Array<ExternalBlob>;
    phone: string;
    fileUrl: string;
}
export interface AttendanceRecord {
    status: string;
    date: string;
    mobile: string;
}
export interface StaffLedgerEntry {
    id: bigint;
    entryType: string;
    date: string;
    description: string;
    mobile: string;
    amount: number;
}
export interface Rider {
    pin: string;
    name: string;
    role: string;
    mobile: string;
    baseSalary: number;
}
export interface PosSaleItem {
    qty: bigint;
    itemName: string;
    unitPrice: number;
    totalPrice: number;
}
export interface FilterOrders {
    status?: string;
    serviceType?: string;
    name?: string;
    phone?: string;
}
export interface TypesettingQuoteRequestInput {
    subject: string;
    name: string;
    language: string;
    phone: string;
    format: string;
    fileUrl: string;
}
export interface ServiceOrder {
    files: Array<ExternalBlob>;
    serviceType: string;
    name: string;
    instructions: string;
    phone: string;
}
export interface TypesettingQuoteRequest {
    id: bigint;
    status: string;
    subject: string;
    name: string;
    submittedAt: bigint;
    language: string;
    quoteNotes: string;
    phone: string;
    finalPdfUrl: string;
    format: string;
    fileUrl: string;
}
export interface BusinessInfo {
    hours: string;
    name: string;
    email: string;
    address: string;
    phone: string;
}
export interface Inquiry {
    name: string;
    message: string;
    phone: string;
}
export interface UserProfile {
    customerName?: string;
    deliveryAddress?: string;
    name: string;
    phone: string;
}
export interface UpiSettings {
    upiId: string;
    qrCodeUrl: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    acceptDelivery(orderId: bigint): Promise<void>;
    addAttendanceRecord(mobile: string, date: string, status: string): Promise<void>;
    addCatalogItem(input: CatalogItemInput): Promise<bigint>;
    addExpense(category: string, amount: number, date: string, paymentMode: string, note: string, addedBy: string): Promise<bigint>;
    addKhataDue(phone: string, customerName: string, amount: number): Promise<number>;
    addManualIncome(category: string, amount: number, date: string, paymentMode: string, description: string): Promise<bigint>;
    addRider(name: string, mobile: string, pin: string): Promise<void>;
    addStaffLedgerEntry(mobile: string, date: string, description: string, amount: number, entryType: string): Promise<bigint>;
    addTeamMember(name: string, mobile: string, pin: string, role: string, baseSalary: number): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    claimAdminWithMasterKey(key: string): Promise<boolean>;
    clearKhataDue(phone: string, amountPaid: number): Promise<number>;
    deductWallet(phone: string, amount: number): Promise<number>;
    deductWalletForOrder(phone: string, amount: number): Promise<number>;
    deleteCatalogItem(id: bigint): Promise<void>;
    deleteExpense(id: bigint): Promise<void>;
    deleteManualIncome(id: bigint): Promise<void>;
    deleteReview(id: bigint): Promise<void>;
    exportBulkLeadsToCsv(): Promise<string>;
    filterOrders(filters: FilterOrders): Promise<Array<OrderRecord>>;
    generateOtp(phone: string): Promise<string>;
    getAllCatalogItems(): Promise<Array<CatalogItem>>;
    getAllKhataEntries(): Promise<Array<KhataEntry>>;
    getAllReviews(): Promise<Array<Review>>;
    getAllShopOrders(): Promise<Array<ShopOrder>>;
    getAllSupportTickets(): Promise<Array<SupportTicket>>;
    getAllTypesettingQuotes(): Promise<Array<TypesettingQuoteRequest>>;
    getAttendanceByDate(date: string): Promise<Array<AttendanceRecord>>;
    getAttendanceForMobile(mobile: string): Promise<Array<AttendanceRecord>>;
    getBusinessInfo(): Promise<BusinessInfo>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getCatalogItem(id: bigint): Promise<CatalogItem | null>;
    getCustomerProfile(phone: string): Promise<{
        customerName: string;
        deliveryAddress: string;
    } | null>;
    getExpenses(): Promise<Array<ExpenseEntry>>;
    getInquiries(): Promise<Array<Inquiry>>;
    getKhataEntry(phone: string): Promise<KhataEntry | null>;
    getManualIncomes(): Promise<Array<ManualIncomeEntry>>;
    getOrderDeliveryOtp(orderId: bigint, phone: string): Promise<string>;
    getOrdersByPhone(phone: string): Promise<Array<OrderRecord>>;
    getPosSales(): Promise<Array<PosSale>>;
    getPosSalesByPhone(phone: string): Promise<Array<PosSale>>;
    getPublishedCatalogItems(): Promise<Array<CatalogItem>>;
    getPublishedReviews(): Promise<Array<Review>>;
    getReadyForDeliveryOrders(): Promise<Array<MaskedShopOrder>>;
    getRiders(): Promise<Array<Rider>>;
    getStaffLedgerEntries(mobile: string): Promise<Array<StaffLedgerEntry>>;
    getSupportTickets(customerMobile: string): Promise<Array<SupportTicket>>;
    getTeamMemberActive(mobile: string): Promise<boolean>;
    getUpiSettings(): Promise<UpiSettings | null>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    getWalletBalance(phone: string): Promise<number>;
    importBulkLeadsFromCsv(csv: string): Promise<void>;
    isCallerAdmin(): Promise<boolean>;
    markOrderDelivered(orderId: bigint, otp: string): Promise<ShopOrder>;
    placeCscShopOrder(phone: string, customerName: string, deliveryMethod: string, deliveryAddress: string, paymentMethod: string, items: Array<ShopOrderItem>, totalAmount: number, cscDocuments: Array<ExternalBlob>, cscSpecialDetails: string): Promise<ShopOrder>;
    placeShopOrder(phone: string, customerName: string, deliveryMethod: string, deliveryAddress: string, paymentMethod: string, items: Array<ShopOrderItem>, totalAmount: number): Promise<ShopOrder>;
    rechargeWallet(phone: string, amount: number): Promise<number>;
    recordPosSale(items: Array<PosSaleItem>, totalAmount: number, paymentMethod: string, customerPhone: string, staffMobile: string): Promise<bigint>;
    removeRider(mobile: string): Promise<void>;
    resetStaffPin(mobile: string, newPin: string): Promise<void>;
    resolveSupportTicket(id: bigint): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    saveCustomerProfile(phone: string, customerName: string, deliveryAddress: string): Promise<void>;
    seedReviews(): Promise<void>;
    setBusinessInfo(ownInfo: BusinessInfo): Promise<void>;
    setUpiSettings(upiId: string, qrCodeUrl: string): Promise<void>;
    submitInquiry(name: string, phone: string, message: string): Promise<void>;
    submitOrder(name: string, phone: string, serviceType: string, instructions: string, fileUrl: string): Promise<bigint>;
    submitOrderFull(input: ServiceOrder): Promise<bigint>;
    submitReview(orderId: bigint, customerName: string, customerPhone: string, location: string, serviceRating: bigint, serviceComment: string, deliveryRating: bigint | null, deliveryComment: string | null): Promise<bigint>;
    submitSupportTicket(orderId: string, customerMobile: string, complaint: string): Promise<bigint>;
    submitTypesettingQuoteRequest(input: TypesettingQuoteRequestInput): Promise<bigint>;
    togglePublishCatalogItem(id: bigint): Promise<void>;
    toggleReviewPublished(id: bigint): Promise<void>;
    toggleTeamMemberActive(mobile: string, isActive: boolean): Promise<void>;
    updateCatalogItem(id: bigint, input: CatalogItemInput): Promise<void>;
    updateExpense(id: bigint, category: string, amount: number, date: string, paymentMode: string, note: string): Promise<void>;
    updateLeadFinalPdf(id: bigint, finalPdfUrl: string): Promise<void>;
    updateLeadQuoteNotes(id: bigint, notes: string): Promise<void>;
    updateManualIncome(id: bigint, category: string, amount: number, date: string, paymentMode: string, description: string): Promise<void>;
    updateOrderStatus(id: bigint, status: string): Promise<void>;
    updateRiderSalary(mobile: string, baseSalary: number): Promise<void>;
    updateShopOrderStatus(id: bigint, status: string): Promise<void>;
    updateTypesettingQuoteStatus(id: bigint, update: TypesettingQuoteUpdate): Promise<void>;
    uploadCscFinalOutput(orderId: bigint, file: ExternalBlob): Promise<void>;
    verifyBulkStaff(mobile: string, pin: string): Promise<boolean>;
    verifyOtp(phone: string, code: string): Promise<boolean>;
    verifyRider(mobile: string, pin: string): Promise<boolean>;
    verifyStaff(mobile: string, pin: string): Promise<boolean>;
}
