import { Routes, Route, Navigate } from 'react-router-dom'
import EventsLayout from './Layout/EventsLayout'
import EventDashboard from './pages/EventDashboard'
import CreateEvent from './pages/CreateEvent'
import Attendees from './pages/Attendees'
import Account from './pages/Account'
import EditProfile from './pages/EditProfile'
import Login from './pages/LoginPage'
import Signup from './pages/SignUp'
import EventDiscover from './pages/EventDiscover'
import EventDetail from './pages/EventDetails'


function App() {
  return (
    <Routes>
      {/* Auth routes — standalone, no sidebar/nav chrome */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route path="/" element={<Navigate to="/events" replace />} />
      <Route path="/events" element={<EventsLayout />}>
        <Route index element={<EventDashboard />} />
        <Route path="create" element={<CreateEvent />} />
        <Route path="attendees" element={<Attendees />} />
        <Route path="account" element={<Account />} />
        <Route path="account/edit" element={<EditProfile />} />
        <Route path="discover" element={<EventDiscover />} />
        <Route path="e/:id" element={<EventDetail />} />
        {/* Add once built: */}
        {/* <Route path="payouts" element={<Payouts />} /> */}
      </Route>
    </Routes >
  )
}

export default App