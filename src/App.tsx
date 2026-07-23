import { Routes, Route, Navigate } from 'react-router-dom'
import EventsLayout from './Layout/EventsLayout'
import EventDashboard from './pages/EventDashboard'
import CreateEvent from './pages/CreateEvent'
import Attendees from './pages/Attendees'
import Account from './pages/Account'
import EditProfile from './pages/EditProfile'


function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/events" replace />} />
      <Route path="/events" element={<EventsLayout />}>
        <Route index element={<EventDashboard />} />
        <Route path="create" element={<CreateEvent />} />
        <Route path="attendees" element={<Attendees />} />
        <Route path="account" element={<Account />} />
        <Route path="account/edit" element={<EditProfile />} />
        {/* Add once built: */}
        {/* <Route path="payouts" element={<Payouts />} /> */}
      </Route>
    </Routes >
  )
}

export default App