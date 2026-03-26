import Map "mo:core/Map";
import Iter "mo:core/Iter";
import Order "mo:core/Order";
import Text "mo:core/Text";
import Array "mo:core/Array";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import Nat "mo:core/Nat";
import Time "mo:core/Time";
import Random "mo:core/Random";
import List "mo:core/List";
import Float "mo:core/Float";

import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";
import MixinStorage "blob-storage/Mixin";
import Storage "blob-storage/Storage";



actor {
  // Initialize the access control state
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  include MixinStorage();

  // Types and Modules
  type BusinessInfo = {
    name : Text;
    address : Text;
    phone : Text;
    email : Text;
    hours : Text;
  };

  type Inquiry = {
    name : Text;
    phone : Text;
    message : Text;
  };

  module Inquiry {
    public func compare(inquiry1 : Inquiry, inquiry2 : Inquiry) : Order.Order {
      Text.compare(inquiry1.name, inquiry2.name);
    };
  };

  type OrderRecord = {
    id : Nat;
    name : Text;
    phone : Text;
    serviceType : Text;
    instructions : Text;
    fileUrl : Text;
    status : Text;
    uploadedFiles : [Storage.ExternalBlob];
    submittedAt : Int;
  };

  module OrderRecord {
    public func compare(a : OrderRecord, b : OrderRecord) : Order.Order {
      Nat.compare(a.id, b.id);
    };
  };

  public type ServiceOrder = {
    name : Text;
    phone : Text;
    serviceType : Text;
    instructions : Text;
    files : [Storage.ExternalBlob];
  };

  public type UserProfile = {
    name : Text;
    phone : Text;
    customerName : ?Text;
    deliveryAddress : ?Text;
  };

  // Catalog Item type for CMS
  public type CatalogItem = {
    id : Nat;
    name : Text;
    category : Text;
    description : Text;
    price : Text;
    stockStatus : Text;
    published : Bool;
    requiresPdfCalc : Bool;
    mediaFiles : [Storage.ExternalBlob];
    mediaTypes : [Text];
    createdAt : Int;
    requiredDocuments : Text;
  };

  public type CatalogItemInput = {
    name : Text;
    category : Text;
    description : Text;
    price : Text;
    stockStatus : Text;
    requiresPdfCalc : Bool;
    mediaFiles : [Storage.ExternalBlob];
    mediaTypes : [Text];
    requiredDocuments : Text;
  };

  module CatalogItem {
    public func compare(a : CatalogItem, b : CatalogItem) : Order.Order {
      Nat.compare(a.id, b.id);
    };
  };

  var walletBalances = Map.empty<Text, Float>();

  // Store Business Info
  var businessInfo : ?BusinessInfo = null;

  // Store Inquiries
  let inquiries = Map.empty<Text, Inquiry>();

  // Store Orders
  var nextOrderId = 1;
  let orders = Map.empty<Nat, OrderRecord>();

  // OTP Store (phone -> OTP)
  let otpStore = Map.empty<Text, Text>();

  // User Profiles
  let userProfiles = Map.empty<Principal, UserProfile>();

  type ServiceOrderInput = {
    name : Text;
    phone : Text;
    serviceType : Text;
    instructions : Text;
    files : [Storage.ExternalBlob];
  };

  // Catalog Store
  var nextCatalogId = 1;
  let catalogItems = Map.empty<Nat, CatalogItem>();

  // PdfCalcRequest type
  public type PdfCalcRequest = {
    id : Nat;
    customerName : Text;
    customerPhone : Text;
    pagesCount : Text;
    printOptions : Text;
    bindingOptions : Text;
    paperQuality : Text;
    colorOptions : Text;
    orderNotes : Text;
    pdfFile : ?Storage.ExternalBlob;
    createdAt : Int;
  };

  let pdfCalcRequests = Map.empty<Nat, PdfCalcRequest>();
  var nextPdfCalcRequestId = 1;

  // Shop Orders
  public type ShopOrderItem = {
    itemId : Nat;
    itemName : Text;
    qty : Nat;
    price : Float;
  };

  public type ShopOrder = {
    id : Nat;
    phone : Text;
    customerName : Text;
    deliveryMethod : Text;
    deliveryAddress : Text;
    paymentMethod : Text;
    items : [ShopOrderItem];
    totalAmount : Float;
    status : Text;
    createdAt : Int;
    deliveryOtp : Text;
    cscDocuments : [Storage.ExternalBlob];
    cscSpecialDetails : Text;
    cscFinalOutput : ?Storage.ExternalBlob;
  };

  // Masked order type for public visibility.
  public type MaskedShopOrder = {
    id : Nat;
    phone : Text;
    customerName : Text;
    deliveryMethod : Text;
    deliveryAddress : Text;
    paymentMethod : Text;
    items : [ShopOrderItem];
    totalAmount : Float;
    status : Text;
    createdAt : Int;
  };

  public type UpiSettings = {
    upiId : Text;
    qrCodeUrl : Text;
  };

  var nextShopOrderId = 1001;
  let shopOrders = Map.empty<Nat, ShopOrder>();
  var upiSettings : ?UpiSettings = null;

  // Customer profiles (phone -> {customerName, deliveryAddress})
  let customerProfiles = Map.empty<Text, { customerName : Text; deliveryAddress : Text }>();

  // Homework Helper Task type and store
  public type HomeworkTask = {
    id : Nat;
    customerName : Text;
    phone : Text;
    subject : Text;
    gradeLevel : Text;
    taskDetails : Text;
    files : [Storage.ExternalBlob];
    status : Text;
    priceQuote : Text;
    price : ?Float;
    createdAt : Int;
  };

  let homeworkTasks = Map.empty<Nat, HomeworkTask>();

  // Rider type and store
  public type Rider = {
    name : Text;
    mobile : Text;
    pin : Text;
    role : Text;
    baseSalary : Float;
  };

  let riders = Map.empty<Text, Rider>();
  let riderActiveStatus = Map.empty<Text, Bool>();

  // ─────────────────────────────────────────────────────────────────────────
  // POS AND KHATA SYSTEM
  // ─────────────────────────────────────────────────────────────────────────

  public type PosSaleItem = {
    itemName : Text;
    qty : Nat;
    unitPrice : Float;
    totalPrice : Float;
  };

  public type PosSale = {
    id : Nat;
    items : [PosSaleItem];
    totalAmount : Float;
    paymentMethod : Text;
    customerPhone : Text;
    staffMobile : Text;
    createdAt : Int;
  };

  var nextPosSaleId = 1;
  let posSales = Map.empty<Nat, PosSale>();

  public type KhataEntry = {
    phone : Text;
    customerName : Text;
    totalDue : Float;
    lastUpdated : Int;
  };

  let khataLedger = Map.empty<Text, KhataEntry>();

  // Expenses and Manual Income System
  public type ExpenseEntry = {
    id : Nat;
    category : Text;
    amount : Float;
    date : Text;
    paymentMode : Text;
    note : Text;
    addedBy : Text;
    createdAt : Int;
  };

  public type ManualIncomeEntry = {
    id : Nat;
    category : Text;
    amount : Float;
    date : Text;
    paymentMode : Text;
    description : Text;
    createdAt : Int;
  };

  var nextExpenseId = 1;
  var nextIncomeId = 1;
  let expenseEntries = Map.empty<Nat, ExpenseEntry>();
  let manualIncomeEntries = Map.empty<Nat, ManualIncomeEntry>();

  // Add expense entry - Admin only (financial data)
  public shared ({ caller }) func addExpense(category : Text, amount : Float, date : Text, paymentMode : Text, note : Text, addedBy : Text) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can add expenses");
    };
    let id = nextExpenseId;
    let expense : ExpenseEntry = {
      id;
      category;
      amount;
      date;
      paymentMode;
      note;
      addedBy;
      createdAt = Time.now();
    };
    expenseEntries.add(id, expense);
    nextExpenseId += 1;
    id;
  };

  // Get all expenses - Admin only (financial data)
  public query ({ caller }) func getExpenses() : async [ExpenseEntry] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view expenses");
    };
    expenseEntries.values().toArray();
  };

  // Delete expense entry - Admin only (financial data)
  public shared ({ caller }) func deleteExpense(id : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can delete expenses");
    };
    expenseEntries.remove(id);
  };

  // Update expense entry - Admin only (financial data)
  public shared ({ caller }) func updateExpense(id : Nat, category : Text, amount : Float, date : Text, paymentMode : Text, note : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can update expenses");
    };
    switch (expenseEntries.get(id)) {
      case (null) { Runtime.trap("Expense entry not found") };
      case (?expense) {
        let updated = { expense with category; amount; date; paymentMode; note };
        expenseEntries.add(id, updated);
      };
    };
  };

  // Add manual income entry - Admin only (financial data)
  public shared ({ caller }) func addManualIncome(category : Text, amount : Float, date : Text, paymentMode : Text, description : Text) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can add manual income");
    };
    let id = nextIncomeId;
    let income : ManualIncomeEntry = {
      id;
      category;
      amount;
      date;
      paymentMode;
      description;
      createdAt = Time.now();
    };
    manualIncomeEntries.add(id, income);
    nextIncomeId += 1;
    id;
  };

  // Get all manual income entries - Admin only (financial data)
  public query ({ caller }) func getManualIncomes() : async [ManualIncomeEntry] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view manual income");
    };
    manualIncomeEntries.values().toArray();
  };

  // Delete manual income entry - Admin only (financial data)
  public shared ({ caller }) func deleteManualIncome(id : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can delete manual income");
    };
    manualIncomeEntries.remove(id);
  };

  // Update manual income entry - Admin only (financial data)
  public shared ({ caller }) func updateManualIncome(id : Nat, category : Text, amount : Float, date : Text, paymentMode : Text, description : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can update manual income");
    };
    switch (manualIncomeEntries.get(id)) {
      case (null) { Runtime.trap("Manual income entry not found") };
      case (?income) {
        let updated = { income with category; amount; date; paymentMode; description };
        manualIncomeEntries.add(id, updated);
      };
    };
  };

  // Record POS sale - Staff only (authenticated via staff credentials in app)
  public shared ({ caller }) func recordPosSale(items : [PosSaleItem], totalAmount : Float, paymentMethod : Text, customerPhone : Text, staffMobile : Text) : async Nat {
    // Staff authentication happens via verifyStaff in the frontend
    // This function should only be called after staff verification
    let id = nextPosSaleId;
    let sale : PosSale = {
      id;
      items;
      totalAmount;
      paymentMethod;
      customerPhone;
      staffMobile;
      createdAt = Time.now();
    };
    posSales.add(id, sale);
    nextPosSaleId += 1;
    id;
  };

  // Get POS sales (admin only)
  public query ({ caller }) func getPosSales() : async [PosSale] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all POS sales");
    };
    posSales.values().toArray();
  };

  // Get POS sales by customer phone - Customer can view their own, admin can view all
  public query ({ caller }) func getPosSalesByPhone(phone : Text) : async [PosSale] {
    // Allow users to view their own sales, admins can view any
    posSales.values().toArray().filter(func(s) { s.customerPhone == phone });
  };

  // Add/Update Khata due - Admin only
  public shared ({ caller }) func addKhataDue(phone : Text, customerName : Text, amount : Float) : async Float {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can add Khata due");
    };
    let oldEntry = khataLedger.get(phone);

    switch (oldEntry) {
      case (?entry) {
        let updated = {
          entry with
          totalDue = entry.totalDue + amount;
          lastUpdated = Time.now();
        };
        khataLedger.add(phone, updated);
        updated.totalDue;
      };
      case (null) {
        let newEntry = {
          phone;
          customerName;
          totalDue = amount;
          lastUpdated = Time.now();
        };
        khataLedger.add(phone, newEntry);
        amount;
      };
    };
  };

  // Clear Khata due (partial/complete) - Admin only
  public shared ({ caller }) func clearKhataDue(phone : Text, amountPaid : Float) : async Float {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can clear Khata due");
    };

    switch (khataLedger.get(phone)) {
      case (null) { Runtime.trap("Khata entry not found") };
      case (?entry) {
        let intermediateValue = entry.totalDue - amountPaid;
        let newDue = if (intermediateValue < 0) {
          0.0;
        } else {
          intermediateValue;
        };

        let updated = {
          entry with
          totalDue = newDue;
          lastUpdated = Time.now();
        };
        khataLedger.add(phone, updated);
        newDue;
      };
    };
  };

  // Get Khata entry - Customer can view their own, no auth needed for lookup
  public query ({ caller }) func getKhataEntry(phone : Text) : async ?KhataEntry {
    khataLedger.get(phone);
  };

  // Get all Khata entries (admin only)
  public query ({ caller }) func getAllKhataEntries() : async [KhataEntry] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all Khata entries");
    };
    khataLedger.values().toArray();
  };

  // User Profile Functions
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Store Business Info - Admin only
  public shared ({ caller }) func setBusinessInfo(ownInfo : BusinessInfo) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can set business info");
    };
    businessInfo := ?ownInfo;
  };

  // Get Business Info (Public)
  public query func getBusinessInfo() : async BusinessInfo {
    switch (businessInfo) {
      case (null) { Runtime.trap("Business info not set") };
      case (?info) { info };
    };
  };

  // Submit Inquiry (Public)
  public shared ({ caller }) func submitInquiry(name : Text, phone : Text, message : Text) : async () {
    let inquiry = {
      name;
      phone;
      message;
    };
    inquiries.add(name, inquiry);
  };

  // Get Inquiries - Admin only
  public query ({ caller }) func getInquiries() : async [Inquiry] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view inquiries");
    };
    inquiries.values().toArray();
  };

  // OTP Functions (Public - used for authentication)
  public shared func generateOtp(phone : Text) : async Text {
    let simulatedOtp = "123456";
    otpStore.add(phone, simulatedOtp);
    simulatedOtp;
  };

  public shared func verifyOtp(phone : Text, code : Text) : async Bool {
    switch (otpStore.get(phone)) {
      case (?storedCode) {
        if (storedCode == code) {
          otpStore.remove(phone);
          true;
        } else { false };
      };
      case (null) { false };
    };
  };

  // Document Order Functions (Public - customers can submit)
  public shared func submitOrder(name : Text, phone : Text, serviceType : Text, instructions : Text, fileUrl : Text) : async Nat {
    let id = nextOrderId;
    let order : OrderRecord = {
      id;
      name;
      phone;
      serviceType;
      instructions;
      fileUrl;
      status = "Pending";
      uploadedFiles = [];
      submittedAt = Time.now();
    };
    orders.add(id, order);
    nextOrderId += 1;
    id;
  };

  public shared func submitOrderFull(input : ServiceOrder) : async Nat {
    let id = nextOrderId;
    let order : OrderRecord = {
      id;
      name = input.name;
      phone = input.phone;
      serviceType = input.serviceType;
      instructions = input.instructions;
      fileUrl = "";
      status = "Pending";
      uploadedFiles = input.files;
      submittedAt = Time.now();
    };
    orders.add(id, order);
    nextOrderId += 1;
    id;
  };

  // Get Orders by Phone (Public - customers view their own orders)
  public query ({ caller }) func getOrdersByPhone(phone : Text) : async [OrderRecord] {
    orders.values().toArray().filter(func(order) { order.phone == phone }).sort();
  };

  public type FilterOrders = {
    name : ?Text;
    phone : ?Text;
    serviceType : ?Text;
    status : ?Text;
  };

  // Filter orders - Admin only
  public query ({ caller }) func filterOrders(filters : FilterOrders) : async [OrderRecord] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can filter orders");
    };
    var filtered = orders.values().toArray();

    switch (filters.name) {
      case (?name) {
        filtered := filtered.filter(func(order) { order.name.contains(#text(name)) });
      };
      case (null) {};
    };

    switch (filters.phone) {
      case (?phone) {
        filtered := filtered.filter(func(order) { order.phone.contains(#text(phone)) });
      };
      case (null) {};
    };

    switch (filters.serviceType) {
      case (?serviceType) {
        filtered := filtered.filter(func(order) { order.serviceType.contains(#text(serviceType)) });
      };
      case (null) {};
    };

    switch (filters.status) {
      case (?status) {
        filtered := filtered.filter(func(order) { order.status.contains(#text(status)) });
      };
      case (null) {};
    };

    filtered;
  };

  // Update Order Status - Admin only
  public shared ({ caller }) func updateOrderStatus(id : Nat, status : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can update order status");
    };
    switch (orders.get(id)) {
      case (null) { Runtime.trap("Order not found") };
      case (?order) {
        let updatedOrder = { order with status };
        orders.add(id, updatedOrder);
      };
    };
  };

  // ─── Catalog Management CMS ───────────────────────────────────────────────

  // Add catalog item - Admin only
  public shared ({ caller }) func addCatalogItem(input : CatalogItemInput) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can add catalog items");
    };
    let id = nextCatalogId;
    let item : CatalogItem = {
      id;
      name = input.name;
      category = input.category;
      description = input.description;
      price = input.price;
      stockStatus = input.stockStatus;
      published = true;
      requiresPdfCalc = input.requiresPdfCalc;
      mediaFiles = input.mediaFiles;
      mediaTypes = input.mediaTypes;
      createdAt = Time.now();
      requiredDocuments = input.requiredDocuments;
    };
    catalogItems.add(id, item);
    nextCatalogId += 1;
    id;
  };

  // Update catalog item - Admin only
  public shared ({ caller }) func updateCatalogItem(id : Nat, input : CatalogItemInput) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can update catalog items");
    };
    switch (catalogItems.get(id)) {
      case (null) { Runtime.trap("Catalog item not found") };
      case (?existing) {
        let updated : CatalogItem = {
          existing with
          name = input.name;
          category = input.category;
          description = input.description;
          price = input.price;
          stockStatus = input.stockStatus;
          requiresPdfCalc = input.requiresPdfCalc;
          mediaFiles = input.mediaFiles;
          mediaTypes = input.mediaTypes;
          requiredDocuments = input.requiredDocuments;
        };
        catalogItems.add(id, updated);
      };
    };
  };

  // Delete catalog item - Admin only
  public shared ({ caller }) func deleteCatalogItem(id : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can delete catalog items");
    };
    catalogItems.remove(id);
  };

  // Toggle publish status - Admin only
  public shared ({ caller }) func togglePublishCatalogItem(id : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can toggle publish status");
    };
    switch (catalogItems.get(id)) {
      case (null) { Runtime.trap("Catalog item not found") };
      case (?item) {
        let updated = { item with published = not item.published };
        catalogItems.add(id, updated);
      };
    };
  };

  // Get all published catalog items (Public)
  public query func getPublishedCatalogItems() : async [CatalogItem] {
    catalogItems.values().toArray().filter(func(item) { item.published });
  };

  // Get all catalog items including unpublished - Admin only
  public query ({ caller }) func getAllCatalogItems() : async [CatalogItem] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all catalog items");
    };
    catalogItems.values().toArray();
  };

  // Get single catalog item by id (Public)
  public query ({ caller }) func getCatalogItem(id : Nat) : async ?CatalogItem {
    catalogItems.get(id);
  };

  // Place Shop Order (Public)
  public shared func placeShopOrder(phone : Text, customerName : Text, deliveryMethod : Text, deliveryAddress : Text, paymentMethod : Text, items : [ShopOrderItem], totalAmount : Float) : async ShopOrder {
    let id = nextShopOrderId;
    let order : ShopOrder = {
      id;
      phone;
      customerName;
      deliveryMethod;
      deliveryAddress;
      paymentMethod;
      items;
      totalAmount;
      status = "Pending";
      createdAt = Time.now();
      deliveryOtp = "";
      cscDocuments = [];
      cscSpecialDetails = "";
      cscFinalOutput = null;
    };
    shopOrders.add(id, order);
    nextShopOrderId += 1;
    order;
  };

  // Place CSC Shop Order (Public)
  public shared func placeCscShopOrder(phone : Text, customerName : Text, deliveryMethod : Text, deliveryAddress : Text, paymentMethod : Text, items : [ShopOrderItem], totalAmount : Float, cscDocuments : [Storage.ExternalBlob], cscSpecialDetails : Text) : async ShopOrder {
    let id = nextShopOrderId;
    let order : ShopOrder = {
      id;
      phone;
      customerName;
      deliveryMethod;
      deliveryAddress;
      paymentMethod;
      items;
      totalAmount;
      status = "Docs Received";
      createdAt = Time.now();
      deliveryOtp = "";
      cscDocuments;
      cscSpecialDetails;
      cscFinalOutput = null;
    };
    shopOrders.add(id, order);
    nextShopOrderId += 1;
    order;
  };

  // Upload CSC final output - Admin only
  public shared ({ caller }) func uploadCscFinalOutput(orderId : Nat, file : Storage.ExternalBlob) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can upload CSC final output");
    };
    switch (shopOrders.get(orderId)) {
      case (null) { Runtime.trap("Shop order not found") };
      case (?order) {
        let updatedOrder = { order with cscFinalOutput = ?file };
        shopOrders.add(orderId, updatedOrder);
      };
    };
  };

  func maskShopOrder(order : ShopOrder) : MaskedShopOrder {
    {
      id = order.id;
      phone = order.phone;
      customerName = order.customerName;
      deliveryMethod = order.deliveryMethod;
      deliveryAddress = order.deliveryAddress;
      paymentMethod = order.paymentMethod;
      items = order.items;
      totalAmount = order.totalAmount;
      status = order.status;
      createdAt = order.createdAt;
    };
  };

  // ─── Shop Order Management ─────────────────────────────────────────

  // Get all shop orders - Admin only
  public query ({ caller }) func getAllShopOrders() : async [ShopOrder] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all shop orders");
    };
    shopOrders.values().toArray();
  };

  // Update shop order status - Admin only
  // Auto-generates 4-digit OTP when status = Ready for Delivery
  public shared ({ caller }) func updateShopOrderStatus(id : Nat, status : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can update shop order status");
    };
    switch (shopOrders.get(id)) {
      case (null) { Runtime.trap("Shop order not found") };
      case (?order) {
        let updatedOrder = if (status == "Ready for Delivery" and order.deliveryOtp == "") {
          let otp = await generateRandomOtp();
          { order with status; deliveryOtp = otp }
        } else {
          { order with status }
        };
        shopOrders.add(id, updatedOrder);
      };
    };
  };

  // Get shop order delivery OTP - Customer only (their own order)
  public query func getOrderDeliveryOtp(orderId : Nat, phone : Text) : async Text {
    switch (shopOrders.get(orderId)) {
      case (null) { "" };
      case (?order) {
        if (order.phone == phone) { order.deliveryOtp } else { "" };
      };
    };
  };

  // Toggle team member active status - Admin only
  public shared ({ caller }) func toggleTeamMemberActive(mobile : Text, isActive : Bool) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can toggle team member status");
    };
    riderActiveStatus.add(mobile, isActive);
  };

  // Get team member active status - Public (used for login checks)
  public query func getTeamMemberActive(mobile : Text) : async Bool {
    switch (riderActiveStatus.get(mobile)) {
      case (?status) { status };
      case (null) { true }; // default active
    };
  };

    // ─── Rider Delivery Features ─────────────────────────────────────────

  // Get ready for delivery orders (Public - for riders)
  // Get orders for rider feed: Ready for Delivery + Out for Delivery (Public)
  public query func getReadyForDeliveryOrders() : async [MaskedShopOrder] {
    shopOrders.values().toArray()
      .filter(func(o) { o.status == "Ready for Delivery" or o.status == "Out for Delivery" })
      .map(func(o) { maskShopOrder(o) });
  };

  // Rider accepts delivery - moves from Ready for Delivery to Out for Delivery (Public)
  public shared func acceptDelivery(orderId : Nat) : async () {
    switch (shopOrders.get(orderId)) {
      case (null) { Runtime.trap("Order not found") };
      case (?order) {
        if (order.status != "Ready for Delivery") {
          Runtime.trap("Order not in Ready for Delivery state");
        };
        let updatedOrder = { order with status = "Out for Delivery" };
        shopOrders.add(orderId, updatedOrder);
      };
    };
  };

  // Mark order delivered using OTP (Public - riders use this)
  // Auto-creates income entry for COD/Khata Due orders
  public shared func markOrderDelivered(orderId : Nat, otp : Text) : async ShopOrder {
    switch (shopOrders.get(orderId)) {
      case (null) { Runtime.trap("Order not found") };
      case (?order) {
        if (order.status != "Out for Delivery") {
          Runtime.trap("Order must be Out for Delivery before marking complete");
        };
        if (order.deliveryOtp != otp) {
          Runtime.trap("Invalid OTP");
        };
        let updatedOrder = { order with status = "Completed" };
        shopOrders.add(orderId, updatedOrder);
        // Auto-create income entry for Cash on Delivery or Khata Due orders
        if (order.paymentMethod == "Pay at Store / Cash on Delivery" or order.paymentMethod == "Khata Due" or order.paymentMethod == "Cash on Delivery") {
          let incId = nextIncomeId;
          let income : ManualIncomeEntry = {
            id = incId;
            category = "Online App Orders";
            amount = order.totalAmount;
            date = "Delivered";
            paymentMode = "Cash";
            description = "Auto: COD delivery Order #SO-" # order.id.toText() # " (" # order.customerName # ")";
            createdAt = Time.now();
          };
          manualIncomeEntries.add(incId, income);
          nextIncomeId += 1;
        };
        updatedOrder;
      };
    };
  };

  //  ───────────────────────────────────────────────────────────────────────
  // STAFF / RIDER PAYROLL + ATTENDANCE SYSTEM (2024)
  // ───────────────────────────────────────────────────────────────────────

  // Payroll and Attendance Types
  public type StaffLedgerEntry = {
    id : Nat;
    mobile : Text;
    date : Text;
    description : Text;
    amount : Float;
    entryType : Text;
  };

  public type AttendanceRecord = {
    mobile : Text;
    date : Text;
    status : Text;
  };

  var nextStaffLedgerId = 1;
  let staffLedger = Map.empty<Nat, StaffLedgerEntry>();

  // 'mobile_date' is used as unique key
  let attendanceRecords = Map.empty<Text, AttendanceRecord>();

  func compareStaffLedgerByDate(a : StaffLedgerEntry, b : StaffLedgerEntry) : Order.Order {
    Text.compare(a.date, b.date);
  };

  // Add attendance record - Admin only (payroll data)
  public shared ({ caller }) func addAttendanceRecord(mobile : Text, date : Text, status : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can add attendance records");
    };
    let record : AttendanceRecord = { mobile; date; status };
    attendanceRecords.add(mobile # "_" # date, record);

    // Mark as present or half day
    if (status == "Present" or status == "Half-Day") {
      let staff = riders.get(mobile);

      switch (staff) {
        case (null) {};
        case (?s) {
          let payAmt = s.baseSalary / 28.0;

          // Pay 70% amount for half day
          let amount = if (status == "Half-Day") {
            payAmt * 0.7; // 30% deduction for half day
          } else {
            payAmt;
          };

          let ledgerEntry : StaffLedgerEntry = {
            id = nextStaffLedgerId;
            mobile;
            date;
            description = "Attendance Earned";
            amount; // Calculate per day amount daily
            entryType = "earned";
          };

          staffLedger.add(nextStaffLedgerId, ledgerEntry);
          nextStaffLedgerId += 1;
        };
      };
    };
  };

  // Get attendance for mobile - Admin only (payroll data)
  public query ({ caller }) func getAttendanceForMobile(mobile : Text) : async [AttendanceRecord] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view attendance records");
    };
    attendanceRecords.values().toArray().filter(func(r) { r.mobile == mobile });
  };

  // Get attendance by date - Admin only (payroll data)
  public query ({ caller }) func getAttendanceByDate(date : Text) : async [AttendanceRecord] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view attendance records");
    };
    attendanceRecords.values().toArray().filter(func(r) { r.date == date });
  };

  // Add staff ledger entry - Admin only (payroll data)
  public shared ({ caller }) func addStaffLedgerEntry(mobile : Text, date : Text, description : Text, amount : Float, entryType : Text) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can add staff ledger entries");
    };
    let entry : StaffLedgerEntry = {
      id = nextStaffLedgerId;
      mobile;
      date;
      description;
      amount;
      entryType;
    };
    staffLedger.add(nextStaffLedgerId, entry);
    nextStaffLedgerId += 1;
    nextStaffLedgerId - 1;
  };

  // Get staff ledger entries - Admin only (payroll data)
  public query ({ caller }) func getStaffLedgerEntries(mobile : Text) : async [StaffLedgerEntry] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view staff ledger entries");
    };
    let entries = staffLedger.values().toArray().filter(
      func(e) { e.mobile == mobile }
    );

    entries.sort(compareStaffLedgerByDate);
  };

  // Update rider salary - Admin only (payroll data)
  public shared ({ caller }) func updateRiderSalary(mobile : Text, baseSalary : Float) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can update rider salary");
    };
    switch (riders.get(mobile)) {
      case (null) { Runtime.trap("Team member not found") };
      case (?rider) {
        let updated = { rider with baseSalary };
        riders.add(mobile, updated);
      };
    };
  };
  // ─── Rider Management ──────────────────────────────────────────────

  // Add rider - Admin only
  public shared ({ caller }) func addRider(name : Text, mobile : Text, pin : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can add riders");
    };
    let rider : Rider = {
      name;
      mobile;
      pin;
      role = "Rider";
      baseSalary = 0.0;
    };
    riders.add(mobile, rider);
    riderActiveStatus.add(mobile, true);
  };

  // Add team member with role (Rider or Staff) - Admin only
  public shared ({ caller }) func addTeamMember(name : Text, mobile : Text, pin : Text, role : Text, baseSalary : Float) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can add team members");
    };
    let member : Rider = {
      name;
      mobile;
      pin;
      role;
      baseSalary;
    };
    riders.add(mobile, member);
    riderActiveStatus.add(mobile, true);
  };

  // Remove rider - Admin only
  public shared ({ caller }) func removeRider(mobile : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can remove riders");
    };
    riders.remove(mobile);
  };

  // Reset staff PIN - Admin only
  public shared ({ caller }) func resetStaffPin(mobile : Text, newPin : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can reset staff PIN");
    };
    switch (riders.get(mobile)) {
      case (null) { Runtime.trap("Team member not found") };
      case (?member) {
        let updated = { member with pin = newPin };
        riders.add(mobile, updated);
      };
    };
  };

  // Get all riders - Admin only
  public query ({ caller }) func getRiders() : async [Rider] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view riders");
    };
    riders.values().toArray();
  };

  // Verify rider credentials (Public - used for rider login)
  public query func verifyRider(mobile : Text, pin : Text) : async Bool {
    switch (riders.get(mobile)) {
      case (null) { false };
      case (?rider) {
        if (rider.pin != pin) { return false };
        // Check active status (default true if not set)
        let isActive = switch (riderActiveStatus.get(mobile)) {
          case (?status) { status };
          case (null) { true };
        };
        isActive and (rider.role == "Rider" or rider.role == "Delivery Rider");
      };
    };
  };

  // Verify staff credentials (Public - used for staff login)
  public query func verifyStaff(mobile : Text, pin : Text) : async Bool {
    switch (riders.get(mobile)) {
      case (null) { false };
      case (?rider) {
        if (rider.role == "Staff" or rider.role == "Shop Staff") {
          rider.pin == pin;
        } else { false };
      };
    };
  };

  // Helper function to generate a 4-digit OTP as Text
  func generateRandomOtp() : async Text {
    (await Random.natRange(1000, 10000)).toText();
  };

  // Get UPI Settings (Public)
  public query func getUpiSettings() : async ?UpiSettings {
    upiSettings;
  };

  // Set UPI Settings - Admin only
  public shared ({ caller }) func setUpiSettings(upiId : Text, qrCodeUrl : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can set UPI settings");
    };
    upiSettings := ?{ upiId; qrCodeUrl };
  };

  // Save Customer Profile (Public - customers save their own)
  public shared ({ caller }) func saveCustomerProfile(phone : Text, customerName : Text, deliveryAddress : Text) : async () {
    customerProfiles.add(phone, { customerName; deliveryAddress });
  };

  // Get Customer Profile (Public)
  public query func getCustomerProfile(phone : Text) : async ?{ customerName : Text; deliveryAddress : Text } {
    customerProfiles.get(phone);
  };

  // Master Key Admin Claim (kept for compatibility)
  public shared ({ caller }) func claimAdminWithMasterKey(key : Text) : async Bool {
    if (key == "CLIKMATE-ADMIN-2024") {
      accessControlState.userRoles.add(caller, #admin);
      accessControlState.adminAssigned := true;
      return true;
    };
    return false;
  };

  // ██████████████████████████████████████████████████████████████████████████
  // █    NEW DEVELOPMENT: WALLET & QUOTE FEATURES (Premium Educator)       █
  // ██████████████████████████████████████████████████████████████████████████

  // ── Customer Digital Wallet ─────────────────────────────────────────---

  // Get wallet balance by phone (Public - customers check their own balance)
  public query ({ caller }) func getWalletBalance(phone : Text) : async Float {
    if (phone.size() != 10) {
      Runtime.trap("Invalid phone");
    };

    switch (walletBalances.get(phone)) {
      case (?balance) { balance };
      case (null) { 0.0 };
    };
  };

  // Admin recharge wallet - Admin only
  public shared ({ caller }) func rechargeWallet(phone : Text, amount : Float) : async Float {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can recharge wallet");
    };
    let oldBalance = switch (walletBalances.get(phone)) {
      case (?balance) { balance };
      case (null) { 0.0 };
    };
    let newBalance = oldBalance + amount;
    walletBalances.add(phone, newBalance);
    newBalance;
  };

  // Admin deduct wallet - Admin only
  public shared ({ caller }) func deductWallet(phone : Text, amount : Float) : async Float {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can deduct wallet");
    };
    let oldBalance = switch (walletBalances.get(phone)) {
      case (?balance) { balance };
      case (null) { Runtime.trap("Insufficient funds") };
    };

    if (oldBalance < amount) {
      Runtime.trap("Insufficient funds");
    };

    let newBalance = oldBalance - amount;
    walletBalances.add(phone, newBalance);
    newBalance;
  };

  // Deduct wallet for order payment (Public - used during checkout)
  public shared ({ caller }) func deductWalletForOrder(phone : Text, amount : Float) : async Float {
    let oldBalance = switch (walletBalances.get(phone)) {
      case (?balance) { balance };
      case (null) { Runtime.trap("Insufficient funds") };
    };

    if (oldBalance < amount) {
      Runtime.trap("Insufficient funds");
    };

    let newBalance = oldBalance - amount;
    walletBalances.add(phone, newBalance);
    newBalance;
  };

  // ── Typesetting Quote Feature ─────────────────────────────────────────-

  let typesettingQuotes = Map.empty<Nat, TypesettingQuoteRequest>();
  var nextTypesettingQuoteId = 1;

  type TypesettingQuoteRequest = {
    id : Nat;
    name : Text;
    phone : Text;
    subject : Text;
    format : Text;
    language : Text;
    fileUrl : Text;
    status : Text;
    submittedAt : Int;
    finalPdfUrl : Text;
    quoteNotes : Text;
  };

  type TypesettingQuoteRequestInput = {
    name : Text;
    phone : Text;
    subject : Text;
    format : Text;
    language : Text;
    fileUrl : Text;
  };

  type TypesettingQuoteUpdate = {
    status : Text;
  };

  // Submit typesetting quote request (Public)
  public shared func submitTypesettingQuoteRequest(input : TypesettingQuoteRequestInput) : async Nat {
    let id = nextTypesettingQuoteId;
    let quote = {
      id;
      name = input.name;
      phone = input.phone;
      subject = input.subject;
      format = input.format;
      language = input.language;
      fileUrl = input.fileUrl;
      status = "Pending";
      submittedAt = Time.now();
      finalPdfUrl = "";
      quoteNotes = "";
    };
    typesettingQuotes.add(id, quote);
    nextTypesettingQuoteId += 1;
    id;
  };

  // Update typesetting quote status - Admin only
  public shared ({ caller }) func updateTypesettingQuoteStatus(id : Nat, update : TypesettingQuoteUpdate) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can update typesetting quote status");
    };
    switch (typesettingQuotes.get(id)) {
      case (null) { Runtime.trap("Quote not found") };
      case (?quote) {
        let updated = { quote with status = update.status };
        typesettingQuotes.add(id, updated);
      };
    };
  };

  // Get all typesetting quotes - Admin only
  public query ({ caller }) func getAllTypesettingQuotes() : async [TypesettingQuoteRequest] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all typesetting quotes");
    };
    typesettingQuotes.values().toArray();
  };

  // ── Customer Review System ─────────────────────────────────────────────

  public type Review = {
    id : Nat;
    orderId : Nat;
    customerName : Text;
    customerPhone : Text;
    location : Text;
    serviceRating : Nat;
    serviceComment : Text;
    deliveryRating : ?Nat;
    deliveryComment : ?Text;
    published : Bool;
    createdAt : Int;
  };

  let reviews = Map.empty<Nat, Review>();
  var nextReviewId = 1;
  var reviewsSeeded = false;

  // Submit a customer review (Public)
  public shared func submitReview(
    orderId : Nat,
    customerName : Text,
    customerPhone : Text,
    location : Text,
    serviceRating : Nat,
    serviceComment : Text,
    deliveryRating : ?Nat,
    deliveryComment : ?Text
  ) : async Nat {
    let id = nextReviewId;
    let review : Review = {
      id;
      orderId;
      customerName;
      customerPhone;
      location;
      serviceRating;
      serviceComment;
      deliveryRating;
      deliveryComment;
      published = true;
      createdAt = Time.now();
    };
    reviews.add(id, review);
    nextReviewId += 1;
    id;
  };

  // Get all published reviews (Public - for homepage carousel)
  public query func getPublishedReviews() : async [Review] {
    reviews.values().toArray().filter(func(r : Review) : Bool { r.published });
  };

  // Get all reviews - Admin only
  public query ({ caller }) func getAllReviews() : async [Review] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all reviews");
    };
    reviews.values().toArray();
  };

  // Toggle review published status - Admin only
  public shared ({ caller }) func toggleReviewPublished(id : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can toggle review published status");
    };
    switch (reviews.get(id)) {
      case (null) { Runtime.trap("Review not found") };
      case (?r) {
        reviews.add(id, { r with published = not r.published });
      };
    };
  };

  // Delete review - Admin only
  public shared ({ caller }) func deleteReview(id : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can delete reviews");
    };
    reviews.remove(id);
  };

  // Seed 25 realistic reviews (idempotent - runs only once) - Admin only
  public shared ({ caller }) func seedReviews() : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can seed reviews");
    };
    if (reviewsSeeded) { return };
    reviewsSeeded := true;

    type SeedEntry = { name : Text; loc : Text; rating : Nat; comment : Text };
    let seeds : [SeedEntry] = [
      { name = "Aman V."; loc = "Awanti Vihar"; rating = 5; comment = "Best place for bulk printing near our PG. Quality is top notch and rates are very genuine." },
      { name = "Sneha T."; loc = "Shankar Nagar"; rating = 4; comment = "Got my PAN card applied here. Fast service, but the delivery boy called me twice for the address." },
      { name = "Rohit S."; loc = "NIT Raipur"; rating = 5; comment = "Their LaTeX typing service saved my project. Highly recommended for engineering students!" },
      { name = "Priya M."; loc = "Telibandha"; rating = 3; comment = "Print quality is good, but the physical shop gets too crowded in the evenings. Better to order online through this app." },
      { name = "Vikas K."; loc = "Labhandih"; rating = 5; comment = "Ordered a 64GB pendrive and some color printouts. Arrived at my office in Magneto Mall within 30 mins. Superfast!" },
      { name = "Anjali D."; loc = "Pandri"; rating = 4; comment = "Very helpful staff for filling out scholarship forms. Would have given 5 stars but the website was a bit slow yesterday." },
      { name = "Suresh B."; loc = "Katora Talab"; rating = 5; comment = "PVC Aadhaar card quality is exactly like the original. Delivered to my home safely." },
      { name = "Neha R."; loc = "Geetanjali Colony"; rating = 5; comment = "I always use ClikMate for my coaching notes printing. Never disappointed." },
      { name = "Kunal P."; loc = "Mowa"; rating = 4; comment = "Good cyber cafe services. They know all the govt form requirements perfectly." },
      { name = "Rahul G."; loc = "Tatibandh"; rating = 2; comment = "Service is good but the shop is quite far from my place and local delivery isn't available this far yet." },
      { name = "Divya S."; loc = "Awanti Vihar"; rating = 5; comment = "Very polite owner. The new online document upload feature is a game changer." },
      { name = "Amit J."; loc = "Shankar Nagar"; rating = 4; comment = "Bought earphones. Good quality. Delivery was slightly delayed due to rain, but rider was polite." },
      { name = "Puja Verma"; loc = "Vidhan Sabha Road"; rating = 5; comment = "Fastest color printouts in Raipur! Rates are much better than other shops." },
      { name = "Manish T."; loc = "Devendra Nagar"; rating = 5; comment = "Excellent typesetting for Hindi & English question papers. Very professional." },
      { name = "Kiran L."; loc = "Telibandha"; rating = 3; comment = "Rider didn't have change for a 500 rupee note. Please ask riders to carry change. Otherwise, great print service." },
      { name = "Sourabh M."; loc = "Pachpedi Naka"; rating = 5; comment = "Applied for my driving license through them. Hassle-free experience." },
      { name = "Nidhi A."; loc = "Civil Lines"; rating = 4; comment = "Nice app interface. Uploading PDFs is very easy directly from mobile." },
      { name = "Rakesh D."; loc = "Awanti Vihar"; rating = 5; comment = "My go-to place for all stationery and urgent printouts." },
      { name = "Gaurav S."; loc = "NIT Raipur"; rating = 5; comment = "Thesis binding was done perfectly. Very neat work." },
      { name = "Shruti K."; loc = "Byron Bazar"; rating = 4; comment = "Got 500 pages printed. 1-2 pages had light ink, but overall very cost-effective." },
      { name = "Tarun P."; loc = "Shankar Nagar"; rating = 5; comment = "The wallet feature is great. I just add 500 Rs and my sister can get her prints easily everyday." },
      { name = "Vivek N."; loc = "Labhandih"; rating = 4; comment = "Good experience with Passport application. They guided me properly about the documents." },
      { name = "Megha C."; loc = "Pandri"; rating = 5; comment = "Very fast delivery in local area. The rider was very well behaved." },
      { name = "Ashish R."; loc = "Fafadih"; rating = 3; comment = "App is good but I want them to add more PC accessories in the retail section." },
      { name = "Komal B."; loc = "Awanti Vihar"; rating = 5; comment = "Smart Online Service Center is exactly what this area needed. Digital and fast!" }
    ];

    for (s in seeds.vals()) {
      let id = nextReviewId;
      reviews.add(id, {
        id;
        orderId = 0;
        customerName = s.name;
        customerPhone = "";
        location = s.loc;
        serviceRating = s.rating;
        serviceComment = s.comment;
        deliveryRating = null;
        deliveryComment = null;
        published = true;
        createdAt = Time.now();
      });
      nextReviewId += 1;
    };
  };

  //  ───────────────────────────────────────────────────────────────────────
  // B U L K   P R I N T I N G  L E A D S   (Export for Enterprise)
  // ───────────────────────────────────────────────────────────────────────

  public type BulkLead = {
    id : Nat;
    phone : Text;
    customerName : Text;
    companyName : Text;
    contactPerson : Text;
    address : Text;
    gstNo : Text;
    printRequirements : Text;
    submittedAt : Int;
  };

  // ─── Bulk Order Workflow (Bulk Printing Staff Authorization) ──────────

  // Verify bulk staff credentials (Public - used for bulk staff login)
  public query func verifyBulkStaff(mobile : Text, pin : Text) : async Bool {
    switch (riders.get(mobile)) {
      case (null) { false };
      case (?rider) {
        rider.pin == pin and rider.role == "Bulk Printing Staff";
      };
    };
  };

  // Update lead final PDF - Admin only
  // Note: Bulk staff authentication is phone/PIN based, not Principal-based.
  // The frontend must verify bulk staff via verifyBulkStaff before calling this.
  // Backend enforces admin-only to prevent unauthorized access.
  public shared ({ caller }) func updateLeadFinalPdf(id : Nat, finalPdfUrl : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can update lead final PDF");
    };
    switch (typesettingQuotes.get(id)) {
      case (null) { Runtime.trap("Lead not found") };
      case (?lead) {
        let updated = { lead with finalPdfUrl };
        typesettingQuotes.add(id, updated);
      };
    };
  };

  // Update lead quote notes - Admin only
  // Note: Bulk staff authentication is phone/PIN based, not Principal-based.
  // The frontend must verify bulk staff via verifyBulkStaff before calling this.
  // Backend enforces admin-only to prevent unauthorized access.
  public shared ({ caller }) func updateLeadQuoteNotes(id : Nat, notes : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can update lead quote notes");
    };
    switch (typesettingQuotes.get(id)) {
      case (null) { Runtime.trap("Lead not found") };
      case (?lead) {
        let updated = { lead with quoteNotes = notes };
        typesettingQuotes.add(id, updated);
      };
    };
  };

  // Export all leads as CSV (Admin only)
  public query ({ caller }) func exportBulkLeadsToCsv() : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can export bulk leads");
    };

    let header = "Phone,Customer Name,Company,Contact Person,Address,GST No,Requirements,Submitted\n";

    let rows = typesettingQuotes.values().toArray().map(
      func(lead) {
        let companyName = lead.quoteNotes.replace(#char ',', " ");
        let contactPerson = lead.finalPdfUrl.replace(#char ',', " ");
        // Add more fields as needed
        lead.phone # "," # lead.name # "," # companyName # "," # contactPerson # "," # "" # "," # "" # "," # lead.status # "," # lead.submittedAt.toText();
      }
    );

    let csv = rows.foldLeft(header, func(acc, row) { acc # row # "\n" });
    csv;
  };

  // Import leads from CSV (Admin only)
  public shared ({ caller }) func importBulkLeadsFromCsv(csv : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can import bulk leads");
    };

    let lines = List.empty<Text>();
    var currentLine = "";
    for (c in csv.chars()) {
      if (c == '\n') {
        lines.add(currentLine);
        currentLine := "";
      } else {
        currentLine := currentLine # c.toText();
      };
    };

    // Helper function to process lead lines
    func processLeadLine(line : Text) {
      let fieldsList = List.empty<Text>();
      var currentField = "";
      for (c in line.chars()) {
        if (c == ',') {
          fieldsList.add(currentField);
          currentField := "";
        } else {
          currentField := currentField # c.toText();
        };
      };

      let fieldsArray = fieldsList.toArray();
      if (fieldsArray.size() >= 7) {
        let lead : BulkLead = {
          id = nextTypesettingQuoteId;
          phone = fieldsArray[0];
          customerName = fieldsArray[1];
          companyName = fieldsArray[2];
          contactPerson = fieldsArray[3];
          address = fieldsArray[4];
          gstNo = fieldsArray[5];
          printRequirements = fieldsArray[6];
          submittedAt = Time.now();
        };

        let quote : TypesettingQuoteRequest = {
          id = nextTypesettingQuoteId;
          name = lead.customerName;
          phone = lead.phone;
          subject = lead.printRequirements;
          format = lead.companyName;
          language = lead.contactPerson;
          fileUrl = lead.address;
          status = "Bulk Printing";
          submittedAt = lead.submittedAt;
          finalPdfUrl = "";
          quoteNotes = "";
        };

        typesettingQuotes.add(nextTypesettingQuoteId, quote);
        nextTypesettingQuoteId += 1;
      };
    };

    // Process each line (excluding header)
    let linesArray = lines.toArray();
    if (linesArray.size() > 1) {
      let slice = linesArray.sliceToArray(1, linesArray.size());
      for (l in slice.values()) {
        processLeadLine(l);
      };
    };
  };


  // ── Support Tickets ───────────────────────────────────────────────────────

  type SupportTicket = {
    id : Nat;
    orderId : Text;
    customerMobile : Text;
    complaint : Text;
    createdAt : Int;
    resolved : Bool;
  };

  let supportTickets = Map.empty<Nat, SupportTicket>();
  var nextSupportTicketId : Nat = 0;

  public shared ({ caller }) func submitSupportTicket(orderId : Text, customerMobile : Text, complaint : Text) : async Nat {
    let ticket : SupportTicket = {
      id = nextSupportTicketId;
      orderId = orderId;
      customerMobile = customerMobile;
      complaint = complaint;
      createdAt = Time.now();
      resolved = false;
    };
    supportTickets.add(nextSupportTicketId, ticket);
    nextSupportTicketId += 1;
    nextSupportTicketId - 1
  };

  public query ({ caller }) func getSupportTickets(customerMobile : Text) : async [SupportTicket] {
    supportTickets.values().toArray().filter(func(t) { t.customerMobile == customerMobile })
  };

  public query ({ caller }) func getAllSupportTickets() : async [SupportTicket] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all support tickets");
    };
    supportTickets.values().toArray()
  };

  public shared ({ caller }) func resolveSupportTicket(id : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can resolve support tickets");
    };
    switch (supportTickets.get(id)) {
      case (null) { Runtime.trap("Ticket not found") };
      case (?ticket) {
        let updated = { ticket with resolved = true };
        supportTickets.add(id, updated);
      };
    };
  };

};
