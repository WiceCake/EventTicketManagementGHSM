# Maintenance Mode Feature

This application now includes a comprehensive maintenance mode system that allows administrators to temporarily disable the application for maintenance purposes.

## Features

- **Global Maintenance Mode**: When enabled, all users see a maintenance page instead of the normal application
- **Admin Access**: Administrators can bypass maintenance mode to access the admin panel
- **Customizable Messages**: Maintenance page content can be customized through the admin interface
- **Persistent Settings**: Maintenance mode state and settings are stored in localStorage

## How to Use

### For Administrators

1. **Enable Maintenance Mode**:
   - Log in as an admin
   - Navigate to Admin > Maintenance in the sidebar
   - Click "Enable Maintenance Mode"
   - Optionally customize the message, estimated time, and contact information
   - Click "Save Settings"

2. **Disable Maintenance Mode**:
   - Access the admin panel (you can always access it during maintenance)
   - Navigate to Admin > Maintenance
   - Click "Disable Maintenance Mode"

3. **Customize Maintenance Page**:
   - Update the maintenance message
   - Set estimated completion time
   - Update contact information
   - Save changes

### For Users

When maintenance mode is active:
- Users will see a maintenance page with the custom message
- The page displays estimated completion time
- Contact information is provided for urgent matters
- Users cannot access the normal application

## Technical Implementation

### Components

- `MaintenanceMode.vue` - The maintenance page component
- `MaintenanceView.vue` - Admin interface for managing maintenance mode
- `useMaintenanceMode.js` - Composable for maintenance mode state management

### Files Modified

- `App.vue` - Added maintenance mode detection and conditional rendering
- `router/router.js` - Added maintenance mode admin route
- `components/SideBar.vue` - Added maintenance mode navigation item

### State Management

The maintenance mode state is managed through:
- `isMaintenanceMode` - Boolean indicating if maintenance mode is active
- `isAdminAccessGranted` - Boolean indicating if admin access has been granted
- `maintenanceConfig` - Object containing maintenance page settings

### Storage

All maintenance mode settings are persisted in localStorage:
- `maintenanceMode` - Stores the enabled state and configuration
- `adminAccessGranted` - Stores admin access status

## Admin Access During Maintenance

When maintenance mode is active, administrators can:
1. Click "Admin Access" on the maintenance page
2. This grants them access to the normal application
3. They can then navigate to the maintenance settings to disable maintenance mode

## Testing

To test the maintenance mode:

1. Start the development server: `npm run dev`
2. Log in as an admin user
3. Navigate to Admin > Maintenance
4. Enable maintenance mode
5. Open a new browser tab/window to see the maintenance page
6. Return to the admin tab to disable maintenance mode

## Environment Variables

No additional environment variables are required for the maintenance mode feature.

## Security Considerations

- Maintenance mode state is stored in localStorage, so it's per-device
- Admin access is granted through the same localStorage mechanism
- In a production environment, you might want to implement server-side maintenance mode control
- Consider implementing proper authentication for admin access during maintenance

## Future Enhancements

Possible improvements:
- Server-side maintenance mode control
- Scheduled maintenance mode activation
- Multiple maintenance message templates
- Real-time notifications when maintenance mode is disabled
- Integration with external monitoring systems
