# Secure Car Hire Platform Specification

This document captures the complete production-ready architecture for the car hire platform, including system architecture, database schema, security, access control, tracking, payments, UI/UX, API structure, deployment, monitoring, and compliance.

## Part 1: System Architecture Overview

### CAR HIRE PLATFORM ARCHITECTURE

- Frontend: Next.js web application
- Mobile App: React Native
- Admin Panel: Dashboard interface
- API Gateway: HTTPS/WSS entrypoint
- Services:
  - Auth Service (JWT)
  - Booking Service
  - Tracking Service (GPS)
- Data Stores:
  - PostgreSQL (primary store)
  - Redis (session and distributed locks)

### Architecture diagram

The platform uses a service-oriented design with frontend clients connecting to a secure API gateway, which routes requests to authentication, booking, and tracking services. PostgreSQL stores normalized business data and Redis handles session state and fast cache/lock workflows.

## Part 2: Database Schema (3NF Compliant)

### Core tables

1. `users`
2. `vehicles`
3. `locations`
4. `rentals`
5. `payments`
6. `tracking_history`
7. `reviews`
8. `maintenance`

### Indexes for performance

- `idx_vehicles_owner`
- `idx_vehicles_status`
- `idx_rentals_renter`
- `idx_rentals_dates`
- `idx_rentals_vehicle`
- `idx_rentals_status`
- `idx_tracking_vehicle`
- `idx_users_email`
- `idx_users_drivers_license`

### Stored procedures

- `is_vehicle_available` checks availability for a date range
- `calculate_commission` computes owner share and platform share

## Part 3: Security Framework

### 3.1 Multi-Layer Security Architecture

- Layer 1: Network Security
  - HTTPS/TLS 1.3
  - DDoS protection
  - Rate limiting
  - WAF
- Layer 2: Authentication & Authorization
  - JWT short expiration
  - Refresh tokens
  - MFA
  - RBAC
  - Session management with Redis
- Layer 3: Application Security
  - Input validation and sanitization
  - Parameterized queries
  - CSRF tokens
  - XSS protection via CSP
  - Per-user rate limits
- Layer 4: Data Security
  - Encryption at rest
  - Encryption in transit
  - PII masking in logs
  - Encrypted backups
  - Security audits
- Layer 5: Monitoring & Response
  - SIEM integration
  - Automated vulnerability scans
  - IDS
  - Incident response plan
  - Security logging retention

### 3.2 Authentication Implementation

Example Spring Security configuration using JWT and role-based route protection.

### 3.3 Cookie Security Settings

Secure cookie configuration:

- `httpOnly: true`
- `secure: true`
- `sameSite: 'strict'`
- `signed: true`
- `maxAge: 15 minutes`

### 3.4 User Verification Requirements

- Identity: Government ID + Selfie via KYC service
- License: Driver's license verification
- Payment: Credit card pre-authorization
- Age: Minimum 21 years
- History: Blacklist and third-party checks

### 3.5 Security Headers

Configured via nginx for strong browser protections and transport security.

## Part 4: User Roles & Access Control

### Role hierarchy

- System Admin
- Owner (Supplier)
- Renter (Customer)
- Support Staff

### Permissions matrix

- Admin: full platform control
- Owner: manage own fleet, earnings, and tracking
- Renter: book rentals, view own trips, cancel own bookings
- Support: handle disputes, view users and transactions

## Part 5: Tracking & GPS Integration

### Real-time tracking requirements

- GPS location updates every 30 seconds
- Speed monitoring in real time
- Geofencing alerts on boundary events
- Mileage and ignition tracking
- Route history stored regularly

### Tracking API endpoints

- `GET /api/tracking/{vehicleId}/current`
- `GET /api/tracking/rental/{rentalId}/history`
- `POST /api/tracking/{rentalId}/geofence`
- WebSocket `/ws/tracking/{bookingId}`

### Vehicle status tracking trigger

Automatic updates transition vehicle status between `pending`, `active`, `completed`, and `available` while handling overdue detection.

## Part 6: Payment & Commission System

### 6.1 70/30 split automation

- Platform commission: 30%
- Owner earnings: 70%
- Platform charges commission immediately
- Owner payout scheduled after completion

### 6.2 Payment security measures

- PCI Level 1 via Stripe/PayPal
- Tokenization of payment details
- 3D Secure required
- Fraud detection screening
- Escrow hold for 24 hours post-rental

## Part 7: UI/UX Design System

### Theme colors

Defines brand palette, status colors, and text/background system tokens.

### Core UI structure

Includes header, search booking widget, filters, and car cards for inventory browsing.

## Part 8: API Endpoints Structure

### Authentication
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/verify-email`
- `POST /api/auth/mfa/verify`

### Vehicles
- `GET /api/vehicles`
- `GET /api/vehicles/{id}`
- `POST /api/vehicles`
- `PUT /api/vehicles/{id}`
- `DELETE /api/vehicles/{id}`
- `GET /api/vehicles/owner/{ownerId}`

### Bookings
- `GET /api/bookings`
- `GET /api/bookings/{id}`
- `POST /api/bookings`
- `PUT /api/bookings/{id}/cancel`
- `PUT /api/bookings/{id}/extend`
- `PUT /api/bookings/{id}/complete`

### Payments
- `POST /api/payments/create-intent`
- `GET /api/payments/status/{id}`
- `GET /api/payments/owner/earnings`
- `POST /api/payments/owner/withdraw`

### Tracking
- `GET /api/tracking/vehicle/{id}`
- `GET /api/tracking/rental/{id}/history`
- `POST /api/tracking/geofence`
- `WS /ws/tracking/{bookingId}`

### Admin
- `GET /api/admin/users`
- `PUT /api/admin/users/{id}/verify`
- `GET /api/admin/transactions`
- `POST /api/admin/dispute/resolve`
- `GET /api/admin/metrics`

## Part 9: Deployment & Infrastructure

### Recommended cloud architecture

Docker Compose production configuration with PostgreSQL, Redis, backend, and nginx.

### Security monitoring (CSPM)

- Daily vulnerability scanning
- Real-time CSPM
- Dependency scanning per PR
- Container scanning at build time
- Quarterly penetration testing

## Part 10: Compliance & Legal Requirements

### Data privacy
- Collect minimum data
- Account deletion workflow
- Data portability export
- Breach notification window
- Consent management

### Rental legal requirements
- Rental agreement inclusion
- Insurance verification
- Age restrictions
- Deposit pre-authorization
- Damage reporting protocol

## Part 11: Monitoring & Alerts

### Critical metrics
- API latency < 200ms
- Payment success > 99%
- GPS uptime > 99.9%
- Login success > 98%
- Booking completion > 85%
- Query time < 50ms

### Security alerts
- Failed login protection
- Suspicious payments review
- Unauthorized API blocking
- GPS tampering alerts

## Deployment checklist

1. Database setup and schema creation
2. Security implementation and RBAC
3. Payment gateway integration and split automation
4. Tracking and real-time WebSocket deployment
5. Monitoring, SIEM, and compliance procedures
