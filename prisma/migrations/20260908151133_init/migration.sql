-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'INSTRUCTOR', 'VENUE_OWNER', 'ADMIN', 'SUPPORT');

-- CreateEnum
CREATE TYPE "DanceStyle" AS ENUM ('HIP_HOP', 'BALLET', 'SALSA', 'BACHATA', 'CONTEMPORARY', 'HEELS', 'KPOP', 'LATIN', 'TANGO', 'ARMENIAN_FOLK', 'JAZZ', 'BREAKING', 'FLAMENCO', 'BALLROOM', 'AFRO', 'WEDDING_DANCE', 'KIDS', 'STRETCHING');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('ALL_LEVELS', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_PROVIDER', 'NO_SHOW', 'RESCHEDULED', 'WAITLISTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BookingSubject" AS ENUM ('CLASS_SESSION', 'PRIVATE_SESSION', 'STUDIO_RENTAL', 'EVENT_TICKET');

-- CreateEnum
CREATE TYPE "BookingLocationOption" AS ENUM ('STUDIO', 'CUSTOMER_LOCATION', 'ONLINE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED', 'CANCELLED', 'CHARGEBACK');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'ARCA', 'IDRAM', 'TELCELL', 'ARCA_QR', 'CASH_ON_DELIVERY');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'PAID', 'PACKING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('SCHEDULED', 'PROCESSING', 'PAID', 'FAILED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LineItemType" AS ENUM ('CLASS_BOOKING', 'PRIVATE_SESSION', 'STUDIO_RENTAL', 'COURSE_ENROLLMENT', 'EVENT_TICKET', 'PRODUCT', 'GIFT_CARD', 'SUBSCRIPTION', 'TRAVEL_FEE', 'DELIVERY_FEE');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('WORKSHOP', 'BATTLE', 'MASTERCLASS', 'SHOWCASE', 'SOCIAL', 'COMPETITION');

-- CreateEnum
CREATE TYPE "VenueAmenity" AS ENUM ('MIRRORS', 'SOUND_SYSTEM', 'SPRUNG_FLOOR', 'WOOD_FLOOR', 'BARRE', 'SHOWERS', 'LOCKERS', 'CHANGING_ROOM', 'AIR_CONDITIONING', 'NATURAL_LIGHT', 'PARKING', 'WIFI', 'WATER_DISPENSER', 'WHEELCHAIR_ACCESS');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('COURIER', 'PICKUP_POINT');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('hy', 'ru', 'en');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "avatarKey" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "locale" "Locale" NOT NULL DEFAULT 'hy',
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Yerevan',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletionRequestedAt" TIMESTAMP(3),
    "anonymizedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OauthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OauthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "identifier" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "recipient" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'AM',
    "city" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "apartment" TEXT,
    "postalCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstructorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "styles" "DanceStyle"[],
    "yearsExperience" INTEGER NOT NULL DEFAULT 0,
    "hourlyRateFrom" INTEGER NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "acceptsTravel" BOOLEAN NOT NULL DEFAULT false,
    "travelRadiusKm" INTEGER,
    "languages" "Locale"[],
    "ratingAverage" DECIMAL(3,2),
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "studentCount" INTEGER NOT NULL DEFAULT 0,
    "moderation" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstructorTranslation" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "headline" TEXT NOT NULL,
    "bio" TEXT NOT NULL,

    CONSTRAINT "InstructorTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstructorExperience" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organization" TEXT,
    "location" TEXT,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InstructorExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceOption" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT,
    "roomId" TEXT,
    "label" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "maxParticipants" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PriceOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Yerevan',
    "addressLine" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "phone" TEXT,
    "amenities" "VenueAmenity"[],
    "openTime" TEXT NOT NULL DEFAULT '08:00',
    "closeTime" TEXT NOT NULL DEFAULT '23:00',
    "ratingAverage" DECIMAL(3,2),
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "moderation" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueTranslation" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "VenueTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueMember" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "areaSqm" INTEGER,
    "capacity" INTEGER NOT NULL,
    "amenities" "VenueAmenity"[],
    "pricePerHour" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT,
    "roomId" TEXT,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityException" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT,
    "roomId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,

    CONSTRAINT "AvailabilityException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlotHold" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT,
    "roomId" TEXT,
    "sessionId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "anonymousId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "extensions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlotHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DanceClass" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "venueId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "style" "DanceStyle" NOT NULL,
    "level" "SkillLevel" NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "learningPoints" TEXT[],
    "isTrending" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ratingAverage" DECIMAL(3,2),
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DanceClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DanceClassTranslation" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "learningPoints" TEXT[],

    CONSTRAINT "DanceClassTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSession" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "roomId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "bookedCount" INTEGER NOT NULL DEFAULT 0,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "claimUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "style" "DanceStyle" NOT NULL,
    "level" "SkillLevel" NOT NULL,
    "price" INTEGER NOT NULL,
    "coverKey" TEXT,
    "totalMinutes" INTEGER NOT NULL DEFAULT 0,
    "requirements" TEXT[],
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseTranslation" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "CourseTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseLesson" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "videoAssetId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPreview" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CourseLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseEnrollment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CourseEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "watchedSeconds" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "subject" "BookingSubject" NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "customerId" TEXT NOT NULL,
    "instructorId" TEXT,
    "venueId" TEXT,
    "roomId" TEXT,
    "sessionId" TEXT,
    "eventId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "participants" INTEGER NOT NULL DEFAULT 1,
    "locationOption" "BookingLocationOption" NOT NULL DEFAULT 'STUDIO',
    "customerAddress" TEXT,
    "basePrice" INTEGER NOT NULL,
    "travelFee" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "totalPrice" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'AMD',
    "cancellationWindowHours" INTEGER NOT NULL,
    "lateCancellationRate" DECIMAL(5,4) NOT NULL,
    "rescheduleWindowHours" INTEGER NOT NULL,
    "maxReschedules" INTEGER NOT NULL,
    "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
    "rescheduledFromId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategoryTranslation" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ProductCategoryTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "brand" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ratingAverage" DECIMAL(3,2),
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTranslation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "ProductTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "price" INTEGER NOT NULL,
    "compareAtPrice" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "weightGrams" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "anonymousId" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'AMD',
    "promoCodeId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "type" "LineItemType" NOT NULL,
    "variantId" TEXT,
    "slotHoldId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "deliveryMethod" "DeliveryMethod",
    "deliveryAddressId" TEXT,
    "deliveryNotes" TEXT,
    "pickupPointCode" TEXT,
    "subtotal" INTEGER NOT NULL,
    "discountTotal" INTEGER NOT NULL DEFAULT 0,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "vatAmount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'AMD',
    "promoCodeId" TEXT,
    "vatRate" DECIMAL(5,4) NOT NULL,
    "pricesIncludeVat" BOOLEAN NOT NULL DEFAULT true,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "LineItemType" NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "variantId" TEXT,
    "bookingId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "lineTotal" INTEGER NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "bookingId" TEXT,
    "subscriptionId" TEXT,
    "provider" TEXT NOT NULL,
    "providerTransactionId" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'AMD',
    "idempotencyKey" TEXT NOT NULL,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "providerPayload" JSONB,
    "authorizedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "orderId" TEXT,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "providerRefundId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "initiatedBy" TEXT,
    "providerPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "paymentId" TEXT,
    "status" "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "processingError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRecord" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "orderItemId" TEXT,
    "instructorId" TEXT,
    "venueId" TEXT,
    "grossAmount" INTEGER NOT NULL,
    "rate" DECIMAL(5,4) NOT NULL,
    "platformFee" INTEGER NOT NULL,
    "providerNet" INTEGER NOT NULL,
    "payoutId" TEXT,
    "releaseAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutAccount" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT,
    "venueId" TEXT,
    "method" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountMasked" TEXT NOT NULL,
    "bankName" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'AMD',
    "status" "PayoutStatus" NOT NULL DEFAULT 'SCHEDULED',
    "idempotencyKey" TEXT NOT NULL,
    "failureReason" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" INTEGER NOT NULL,
    "minOrderTotal" INTEGER,
    "maxDiscount" INTEGER,
    "appliesTo" "LineItemType"[],
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "perUserLimit" INTEGER NOT NULL DEFAULT 1,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCard" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purchaserId" TEXT,
    "orderId" TEXT,
    "initialAmount" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'AMD',
    "recipientEmail" TEXT,
    "message" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "interval" "BillingInterval" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "priceSnapshot" INTEGER NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "trialEndsAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionUsage" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "metric" TEXT NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SubscriptionUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "style" "DanceStyle",
    "level" "SkillLevel" NOT NULL DEFAULT 'ALL_LEVELS',
    "instructorId" TEXT,
    "venueId" TEXT,
    "locationName" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "capacity" INTEGER NOT NULL,
    "bookedCount" INTEGER NOT NULL DEFAULT 0,
    "coverKey" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventTranslation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "EventTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "bookingId" TEXT,
    "instructorId" TEXT,
    "classId" TEXT,
    "courseId" TEXT,
    "productId" TEXT,
    "venueId" TEXT,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "isVerifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
    "moderation" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "moderatedById" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "editableUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classId" TEXT,
    "productId" TEXT,
    "instructorId" TEXT,
    "venueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "altText" TEXT NOT NULL,
    "blurDataUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "instructorId" TEXT,
    "venueId" TEXT,
    "roomId" TEXT,
    "classId" TEXT,
    "productId" TEXT,
    "eventId" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAssetTranslation" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "altText" TEXT NOT NULL,

    CONSTRAINT "MediaAssetTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "type" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL,
    "locale" "Locale" NOT NULL,
    "providerMessageId" TEXT,
    "failureReason" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "userId" TEXT,
    "token" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" "UserRole",
    "actorEmail" TEXT NOT NULL DEFAULT 'system',
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "diff" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "revertedAt" TIMESTAMP(3),
    "revertedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessControl" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "capability" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessGrant" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "capability" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "runKey" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "succeeded" BOOLEAN,
    "error" TEXT,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "OauthAccount_userId_idx" ON "OauthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OauthAccount_provider_providerUserId_key" ON "OauthAccount"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_tokenHash_key" ON "VerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "VerificationToken_identifier_purpose_idx" ON "VerificationToken"("identifier", "purpose");

-- CreateIndex
CREATE INDEX "VerificationToken_expiresAt_idx" ON "VerificationToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_channel_type_key" ON "NotificationPreference"("userId", "channel", "type");

-- CreateIndex
CREATE INDEX "Address_userId_idx" ON "Address"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InstructorProfile_userId_key" ON "InstructorProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InstructorProfile_slug_key" ON "InstructorProfile"("slug");

-- CreateIndex
CREATE INDEX "InstructorProfile_moderation_isVerified_idx" ON "InstructorProfile"("moderation", "isVerified");

-- CreateIndex
CREATE INDEX "InstructorProfile_ratingAverage_idx" ON "InstructorProfile"("ratingAverage");

-- CreateIndex
CREATE UNIQUE INDEX "InstructorTranslation_instructorId_locale_key" ON "InstructorTranslation"("instructorId", "locale");

-- CreateIndex
CREATE INDEX "InstructorExperience_instructorId_idx" ON "InstructorExperience"("instructorId");

-- CreateIndex
CREATE INDEX "PriceOption_instructorId_isActive_idx" ON "PriceOption"("instructorId", "isActive");

-- CreateIndex
CREATE INDEX "PriceOption_roomId_isActive_idx" ON "PriceOption"("roomId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Venue_slug_key" ON "Venue"("slug");

-- CreateIndex
CREATE INDEX "Venue_city_district_idx" ON "Venue"("city", "district");

-- CreateIndex
CREATE INDEX "Venue_moderation_idx" ON "Venue"("moderation");

-- CreateIndex
CREATE UNIQUE INDEX "VenueTranslation_venueId_locale_key" ON "VenueTranslation"("venueId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "VenueMember_venueId_userId_key" ON "VenueMember"("venueId", "userId");

-- CreateIndex
CREATE INDEX "Room_venueId_isActive_idx" ON "Room"("venueId", "isActive");

-- CreateIndex
CREATE INDEX "AvailabilityRule_instructorId_weekday_isActive_idx" ON "AvailabilityRule"("instructorId", "weekday", "isActive");

-- CreateIndex
CREATE INDEX "AvailabilityRule_roomId_weekday_isActive_idx" ON "AvailabilityRule"("roomId", "weekday", "isActive");

-- CreateIndex
CREATE INDEX "AvailabilityException_instructorId_startsAt_endsAt_idx" ON "AvailabilityException"("instructorId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "AvailabilityException_roomId_startsAt_endsAt_idx" ON "AvailabilityException"("roomId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "SlotHold_expiresAt_idx" ON "SlotHold"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlotHold_instructorId_startsAt_key" ON "SlotHold"("instructorId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlotHold_roomId_startsAt_key" ON "SlotHold"("roomId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "DanceClass_slug_key" ON "DanceClass"("slug");

-- CreateIndex
CREATE INDEX "DanceClass_style_level_isActive_idx" ON "DanceClass"("style", "level", "isActive");

-- CreateIndex
CREATE INDEX "DanceClass_instructorId_isActive_idx" ON "DanceClass"("instructorId", "isActive");

-- CreateIndex
CREATE INDEX "DanceClass_isTrending_isActive_idx" ON "DanceClass"("isTrending", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DanceClassTranslation_classId_locale_key" ON "DanceClassTranslation"("classId", "locale");

-- CreateIndex
CREATE INDEX "ClassSession_startsAt_isCancelled_idx" ON "ClassSession"("startsAt", "isCancelled");

-- CreateIndex
CREATE INDEX "ClassSession_roomId_startsAt_idx" ON "ClassSession"("roomId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSession_classId_startsAt_key" ON "ClassSession"("classId", "startsAt");

-- CreateIndex
CREATE INDEX "WaitlistEntry_sessionId_position_idx" ON "WaitlistEntry"("sessionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_sessionId_userId_key" ON "WaitlistEntry"("sessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE INDEX "Course_style_level_isPublished_idx" ON "Course"("style", "level", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "CourseTranslation_courseId_locale_key" ON "CourseTranslation"("courseId", "locale");

-- CreateIndex
CREATE INDEX "CourseLesson_courseId_sortOrder_idx" ON "CourseLesson"("courseId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CourseLesson_courseId_slug_key" ON "CourseLesson"("courseId", "slug");

-- CreateIndex
CREATE INDEX "CourseEnrollment_userId_idx" ON "CourseEnrollment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseEnrollment_courseId_userId_key" ON "CourseEnrollment"("courseId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_enrollmentId_lessonId_key" ON "LessonProgress"("enrollmentId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");

-- CreateIndex
CREATE INDEX "Booking_customerId_status_idx" ON "Booking"("customerId", "status");

-- CreateIndex
CREATE INDEX "Booking_instructorId_startsAt_idx" ON "Booking"("instructorId", "startsAt");

-- CreateIndex
CREATE INDEX "Booking_roomId_startsAt_idx" ON "Booking"("roomId", "startsAt");

-- CreateIndex
CREATE INDEX "Booking_status_startsAt_idx" ON "Booking"("status", "startsAt");

-- CreateIndex
CREATE INDEX "Booking_startsAt_endsAt_idx" ON "Booking"("startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_slug_key" ON "ProductCategory"("slug");

-- CreateIndex
CREATE INDEX "ProductCategory_parentId_isActive_idx" ON "ProductCategory"("parentId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategoryTranslation_categoryId_locale_key" ON "ProductCategoryTranslation"("categoryId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_categoryId_isActive_idx" ON "Product"("categoryId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTranslation_productId_locale_key" ON "ProductTranslation"("productId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_isActive_idx" ON "ProductVariant"("productId", "isActive");

-- CreateIndex
CREATE INDEX "ProductVariant_stock_idx" ON "ProductVariant"("stock");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_anonymousId_key" ON "Cart"("anonymousId");

-- CreateIndex
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_userId_status_idx" ON "Order"("userId", "status");

-- CreateIndex
CREATE INDEX "Order_status_placedAt_idx" ON "Order"("status", "placedAt");

-- CreateIndex
CREATE INDEX "Order_placedAt_idx" ON "Order"("placedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_bookingId_key" ON "OrderItem"("bookingId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerTransactionId_key" ON "Payment"("providerTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_providerRefundId_key" ON "Refund"("providerRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_receivedAt_idx" ON "WebhookEvent"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key" ON "WebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionRecord_bookingId_key" ON "CommissionRecord"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionRecord_orderItemId_key" ON "CommissionRecord"("orderItemId");

-- CreateIndex
CREATE INDEX "CommissionRecord_instructorId_payoutId_idx" ON "CommissionRecord"("instructorId", "payoutId");

-- CreateIndex
CREATE INDEX "CommissionRecord_venueId_payoutId_idx" ON "CommissionRecord"("venueId", "payoutId");

-- CreateIndex
CREATE INDEX "CommissionRecord_releaseAt_idx" ON "CommissionRecord"("releaseAt");

-- CreateIndex
CREATE INDEX "PayoutAccount_instructorId_idx" ON "PayoutAccount"("instructorId");

-- CreateIndex
CREATE INDEX "PayoutAccount_venueId_idx" ON "PayoutAccount"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_reference_key" ON "Payout"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_idempotencyKey_key" ON "Payout"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payout_status_periodEnd_idx" ON "Payout"("status", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "PromoCode_isActive_endsAt_idx" ON "PromoCode"("isActive", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_code_key" ON "GiftCard"("code");

-- CreateIndex
CREATE INDEX "GiftCard_balance_expiresAt_idx" ON "GiftCard"("balance", "expiresAt");

-- CreateIndex
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");

-- CreateIndex
CREATE INDEX "Subscription_status_currentPeriodEnd_idx" ON "Subscription"("status", "currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionUsage_subscriptionId_periodStart_metric_key" ON "SubscriptionUsage"("subscriptionId", "periodStart", "metric");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_startsAt_isPublished_idx" ON "Event"("startsAt", "isPublished");

-- CreateIndex
CREATE INDEX "Event_type_startsAt_idx" ON "Event"("type", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventTranslation_eventId_locale_key" ON "EventTranslation"("eventId", "locale");

-- CreateIndex
CREATE INDEX "Review_instructorId_moderation_idx" ON "Review"("instructorId", "moderation");

-- CreateIndex
CREATE INDEX "Review_classId_moderation_idx" ON "Review"("classId", "moderation");

-- CreateIndex
CREATE INDEX "Review_productId_moderation_idx" ON "Review"("productId", "moderation");

-- CreateIndex
CREATE INDEX "Review_moderation_createdAt_idx" ON "Review"("moderation", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_authorId_bookingId_key" ON "Review"("authorId", "bookingId");

-- CreateIndex
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_classId_key" ON "Favorite"("userId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_productId_key" ON "Favorite"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_instructorId_key" ON "Favorite"("userId", "instructorId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_venueId_key" ON "Favorite"("userId", "venueId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "MediaAsset_instructorId_sortOrder_idx" ON "MediaAsset"("instructorId", "sortOrder");

-- CreateIndex
CREATE INDEX "MediaAsset_productId_sortOrder_idx" ON "MediaAsset"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "MediaAsset_classId_sortOrder_idx" ON "MediaAsset"("classId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAssetTranslation_assetId_locale_key" ON "MediaAssetTranslation"("assetId", "locale");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_status_scheduledFor_idx" ON "Notification"("status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_token_key" ON "NewsletterSubscriber"("token");

-- CreateIndex
CREATE INDEX "NewsletterSubscriber_confirmedAt_unsubscribedAt_idx" ON "NewsletterSubscriber"("confirmedAt", "unsubscribedAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AccessControl_role_idx" ON "AccessControl"("role");

-- CreateIndex
CREATE UNIQUE INDEX "AccessControl_role_capability_key" ON "AccessControl"("role", "capability");

-- CreateIndex
CREATE INDEX "AccessGrant_role_expiresAt_idx" ON "AccessGrant"("role", "expiresAt");

-- CreateIndex
CREATE INDEX "AccessGrant_expiresAt_idx" ON "AccessGrant"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoginAttempt_identifier_key" ON "LoginAttempt"("identifier");

-- CreateIndex
CREATE INDEX "LoginAttempt_lockedUntil_idx" ON "LoginAttempt"("lockedUntil");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_createdAt_idx" ON "ApprovalRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_requestedById_idx" ON "ApprovalRequest"("requestedById");

-- CreateIndex
CREATE INDEX "JobRun_jobName_startedAt_idx" ON "JobRun"("jobName", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobRun_jobName_runKey_key" ON "JobRun"("jobName", "runKey");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OauthAccount" ADD CONSTRAINT "OauthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorProfile" ADD CONSTRAINT "InstructorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorTranslation" ADD CONSTRAINT "InstructorTranslation_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "InstructorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorExperience" ADD CONSTRAINT "InstructorExperience_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "InstructorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceOption" ADD CONSTRAINT "PriceOption_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "InstructorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceOption" ADD CONSTRAINT "PriceOption_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueTranslation" ADD CONSTRAINT "VenueTranslation_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueMember" ADD CONSTRAINT "VenueMember_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueMember" ADD CONSTRAINT "VenueMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "InstructorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityException" ADD CONSTRAINT "AvailabilityException_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "InstructorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityException" ADD CONSTRAINT "AvailabilityException_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DanceClass" ADD CONSTRAINT "DanceClass_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "InstructorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DanceClass" ADD CONSTRAINT "DanceClass_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DanceClassTranslation" ADD CONSTRAINT "DanceClassTranslation_classId_fkey" FOREIGN KEY ("classId") REFERENCES "DanceClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_classId_fkey" FOREIGN KEY ("classId") REFERENCES "DanceClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "InstructorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseTranslation" ADD CONSTRAINT "CourseTranslation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseLesson" ADD CONSTRAINT "CourseLesson_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CourseEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "InstructorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategoryTranslation" ADD CONSTRAINT "ProductCategoryTranslation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTranslation" ADD CONSTRAINT "ProductTranslation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryAddressId_fkey" FOREIGN KEY ("deliveryAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "InstructorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutAccount" ADD CONSTRAINT "PayoutAccount_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "InstructorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutAccount" ADD CONSTRAINT "PayoutAccount_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PayoutAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_purchaserId_fkey" FOREIGN KEY ("purchaserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionUsage" ADD CONSTRAINT "SubscriptionUsage_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "InstructorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTranslation" ADD CONSTRAINT "EventTranslation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "InstructorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_classId_fkey" FOREIGN KEY ("classId") REFERENCES "DanceClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_classId_fkey" FOREIGN KEY ("classId") REFERENCES "DanceClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "InstructorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_classId_fkey" FOREIGN KEY ("classId") REFERENCES "DanceClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAssetTranslation" ADD CONSTRAINT "MediaAssetTranslation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
