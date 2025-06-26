# Booking Conflict Prevention System

## Overview

The booking conflict prevention system ensures that no two users can book the same vehicle at overlapping times, with an additional 1-hour buffer period before and after each booking to allow for vehicle preparation and handover.

## How It Works

### Time-Based Conflict Detection

The system uses a sophisticated time-based algorithm that:

1. **Converts times to minutes** for accurate comparison
2. **Adds 1-hour buffers** before and after each booking
3. **Checks for overlaps** between booking time slots
4. **Excludes cancelled/rejected bookings** from conflict detection

### Example Scenario

**Jyoti's Booking:**
- Vehicle ID: 12
- Date: June 24, 2025
- Time: 09:10 AM - 11:10 AM (2 hours)
- Status: Confirmed

**Protected Time Slots:**
- Buffer before: 08:10 AM - 09:10 AM (1 hour)
- Actual booking: 09:10 AM - 11:10 AM (2 hours)
- Buffer after: 11:10 AM - 12:10 PM (1 hour)
- **Total protected period: 08:10 AM - 12:10 PM (4 hours)**

### Conflict Examples

#### ❌ Conflicting Booking (Blocked)
- Vehicle ID: 12
- Date: June 24, 2025
- Time: 10:00 AM - 12:00 PM
- **Result: CONFLICT DETECTED**
- **Error:** "Vehicle is already booked from 09:10 for 2 hours. Please choose a different time slot with at least 1 hour gap."

#### ❌ Buffer Violation (Blocked)
- Vehicle ID: 12
- Date: June 24, 2025
- Time: 12:00 PM - 02:00 PM
- **Result: BUFFER VIOLATION DETECTED**
- **Reason:** Only 50 minutes gap (needs 1 hour)

#### ✅ Valid Booking (Allowed)
- Vehicle ID: 12
- Date: June 24, 2025
- Time: 12:30 PM - 02:30 PM
- **Result: VALID BOOKING**
- **Reason:** 1 hour 20 minutes gap (exceeds 1-hour requirement)

#### ✅ Different Vehicle (Allowed)
- Vehicle ID: 5 (different vehicle)
- Date: June 24, 2025
- Time: 10:00 AM - 12:00 PM
- **Result: VALID BOOKING**
- **Reason:** Different vehicle, no conflicts

## Implementation Details

### Server-Side Logic

The conflict detection is implemented in `server-new.js` with the `checkTimeConflict()` function:

```javascript
function checkTimeConflict(existingBookings, vehicleId, startDate, startTime, duration) {
    // Convert times to minutes
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = startTimeMinutes + (duration * 60);
    
    // Add 1-hour buffer
    const bufferStartTime = startTimeMinutes - 60;
    const bufferEndTime = endTimeMinutes + 60;
    
    // Check for conflicts with existing bookings
    for (const booking of existingBookings) {
        // Skip different vehicles/dates and cancelled bookings
        if (String(booking.vehicleId) !== String(vehicleId) || 
            booking.startDate !== startDate ||
            booking.status === 'cancelled' || 
            booking.status === 'rejected') {
            continue;
        }
        
        // Check for overlap
        const [existingHour, existingMinute] = booking.startTime.split(':').map(Number);
        const existingStartTimeMinutes = existingHour * 60 + existingMinute;
        const existingEndTimeMinutes = existingStartTimeMinutes + (booking.duration * 60);
        
        if (existingStartTimeMinutes < bufferEndTime && existingEndTimeMinutes > bufferStartTime) {
            return {
                conflict: true,
                existingBooking: booking,
                message: `Vehicle is already booked from ${booking.startTime} for ${booking.duration} hours. Please choose a different time slot with at least 1 hour gap.`
            };
        }
    }
    
    return { conflict: false };
}
```

### API Endpoints

The system is integrated into these API endpoints:

1. **POST /api/bookings** - User booking creation
2. **PUT /api/admin/bookings/:id** - Admin booking updates
3. **GET /api/admin/bookings/:id** - Admin booking details

### Frontend Integration

The system provides clear error messages to users:

- **Conflict detected:** Shows existing booking details and suggests alternative times
- **Buffer violation:** Explains the 1-hour gap requirement
- **Valid booking:** Proceeds with booking creation

## Benefits

1. **Prevents Double Bookings:** No two users can book the same vehicle simultaneously
2. **Buffer Time:** 1-hour gaps allow for vehicle preparation and handover
3. **Clear Feedback:** Users receive specific error messages explaining conflicts
4. **Flexible:** Different vehicles can be booked simultaneously
5. **Admin Control:** Admins can edit bookings while maintaining conflict prevention

## Testing

Run the test script to see the system in action:

```bash
node test-booking-conflict.js
```

This will demonstrate various conflict scenarios and show how the system responds to each case.

## Configuration

The 1-hour buffer can be adjusted by modifying the buffer calculation in the `checkTimeConflict()` function:

```javascript
const bufferStartTime = startTimeMinutes - 60; // Change 60 to desired minutes
const bufferEndTime = endTimeMinutes + 60;     // Change 60 to desired minutes
``` 