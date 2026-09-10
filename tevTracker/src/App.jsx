import { useEffect, useMemo, useState } from 'react'
import './App.css'

const createEmptyRow = (date = '') => ({
  date,
  destination: '',
  departureTime: '',
  arrivalTime: '',
  meansOfTransportation: 'Flight',
  transportationCost: '',
})

function App() {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
  const backupApiUrl = 'http://localhost:5001/api'
  const [itineraries, setItineraries] = useState([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalDate, setModalDate] = useState(new Date().toISOString().slice(0, 10))
  const [modalRows, setModalRows] = useState([createEmptyRow(new Date().toISOString().slice(0, 10))])
  const [modalError, setModalError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const requestJson = async (path, options = {}) => {
    const urls = [apiUrl, backupApiUrl].filter(Boolean)

    let lastError = null

    for (const baseUrl of urls) {
      try {
        const response = await fetch(`${baseUrl}${path}`, options)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || 'Request failed.')
        }

        return data
      } catch (error) {
        lastError = error
      }
    }

    throw lastError || new Error('Request failed.')
  }

  const fetchItineraries = async () => {
    try {
      const data = await requestJson('/trips')
      setItineraries(data)
    } catch (fetchError) {
      setError(fetchError.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchItineraries()
  }, [])

  const sortedItineraries = useMemo(
    () =>
      [...itineraries].sort((firstEntry, secondEntry) => {
        const firstDate = new Date(firstEntry.date).getTime()
        const secondDate = new Date(secondEntry.date).getTime()

        if (firstDate === secondDate) {
          return firstEntry.destination.localeCompare(secondEntry.destination)
        }

        return secondDate - firstDate
      }),
    [itineraries],
  )

  const totalPages = Math.max(1, Math.ceil(sortedItineraries.length / pageSize))
  const paginatedItineraries = sortedItineraries.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )

  useEffect(() => {
    setCurrentPage((previousPage) => Math.min(previousPage, totalPages))
  }, [totalPages])

  const dailyTotals = useMemo(() => {
    const totals = itineraries.reduce((accumulator, itinerary) => {
      const key = itinerary.date
      accumulator[key] = (accumulator[key] || 0) + Number(itinerary.transportationCost || 0)
      return accumulator
    }, {})

    return Object.entries(totals).sort(
      ([firstDate], [secondDate]) => new Date(firstDate) - new Date(secondDate),
    )
  }, [itineraries])

  const openModal = () => {
    const today = new Date().toISOString().slice(0, 10)
    setModalDate(today)
    setModalRows([createEmptyRow(today)])
    setModalError('')
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setModalError('')
  }

  const openEditModal = (record) => {
    setEditingRecord(record)
    setEditForm({
      date: record.date,
      destination: record.destination,
      departureTime: record.departureTime,
      arrivalTime: record.arrivalTime,
      meansOfTransportation: record.meansOfTransportation,
      transportationCost: String(record.transportationCost),
    })
    setIsEditModalOpen(true)
  }

  const closeEditModal = () => {
    setIsEditModalOpen(false)
    setEditingRecord(null)
    setEditForm(null)
  }

  const handleModalRowChange = (index, field, value) => {
    setModalRows((prevRows) =>
      prevRows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    )
  }

  const handleEditFieldChange = (field, value) => {
    setEditForm((prevForm) => ({
      ...prevForm,
      [field]: value,
    }))
  }

  const addModalRow = () => {
    setModalRows((prevRows) => [...prevRows, createEmptyRow(modalDate)])
  }

  const removeModalRow = (index) => {
    setModalRows((prevRows) => {
      if (prevRows.length === 1) {
        return [createEmptyRow(modalDate)]
      }

      return prevRows.filter((_, rowIndex) => rowIndex !== index)
    })
  }

  const handleBatchSubmit = async () => {
    setModalError('')

    if (!modalDate) {
      setModalError('Please choose a date before saving.')
      return
    }

    const validRows = modalRows.filter(
      (row) => row.destination || row.departureTime || row.arrivalTime || row.transportationCost,
    )

    if (validRows.length === 0) {
      setModalError('Add at least one itinerary row before confirming.')
      return
    }

    const invalidRow = validRows.find(
      (row) =>
        !row.destination ||
        !row.departureTime ||
        !row.arrivalTime ||
        row.transportationCost === '',
    )

    if (invalidRow) {
      setModalError('Each itinerary row must include destination, time values, and transportation cost.')
      return
    }

    setIsSubmitting(true)

    try {
      const saveRequests = validRows.map((row) =>
        requestJson('/trips', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            date: modalDate,
            destination: row.destination,
            departureTime: row.departureTime,
            arrivalTime: row.arrivalTime,
            meansOfTransportation: row.meansOfTransportation,
            transportationCost: Number(row.transportationCost),
          }),
        }),
      )

      await Promise.all(saveRequests)
      setIsModalOpen(false)
      setModalRows([createEmptyRow(modalDate)])
      await fetchItineraries()
    } catch (submitError) {
      setModalError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditSubmit = async () => {
    if (!editingRecord || !editForm) {
      return
    }

    const payload = {
      date: editForm.date,
      destination: editForm.destination,
      departureTime: editForm.departureTime,
      arrivalTime: editForm.arrivalTime,
      meansOfTransportation: editForm.meansOfTransportation,
      transportationCost: Number(editForm.transportationCost),
    }

    if (
      !payload.date ||
      !payload.destination ||
      !payload.departureTime ||
      !payload.arrivalTime ||
      !payload.meansOfTransportation ||
      payload.transportationCost === '' ||
      Number.isNaN(payload.transportationCost)
    ) {
      setError('Please complete the trip details before saving the changes.')
      return
    }

    try {
      await requestJson(`/trips/${editingRecord._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      closeEditModal()
      await fetchItineraries()
    } catch (submitError) {
      setError(submitError.message)
    }
  }

  const handleDeleteRecord = async (record) => {
    if (!record?._id) {
      return
    }

    const confirmed = window.confirm(`Delete the itinerary for ${record.destination} on ${record.date}?`)
    if (!confirmed) {
      return
    }

    try {
      await requestJson(`/trips/${record._id}`, {
        method: 'DELETE',
      })
      await fetchItineraries()
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  const handleDeleteAllRecords = async () => {
    const confirmed = window.confirm('Delete all itinerary entries? This cannot be undone.')
    if (!confirmed) {
      return
    }

    try {
      await requestJson('/trips', {
        method: 'DELETE',
      })
      setCurrentPage(1)
      await fetchItineraries()
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  const handleDeleteAllForDate = async (date) => {
    const confirmed = window.confirm(`Delete all trip entries for ${date}?`)
    if (!confirmed) {
      return
    }

    try {
      await requestJson(`/trips/date/${encodeURIComponent(date)}`, {
        method: 'DELETE',
      })
      await fetchItineraries()
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  return (
    <main className="app-shell">
      <section className="panel hero-panel">
        <div>
          <p className="eyebrow">Travel records</p>
          <h1>TEV Tracker</h1>
        </div>
        <p className="subtitle">
          Manage your travel itinerary with dates, transport details, and total travel cost.
        </p>
      </section>

      <section className="panel form-panel">
        <div className="section-title-row">
          <h2>Add itinerary</h2>
          <div className="button-stack">
            <button className="primary-button" type="button" onClick={openModal}>
              + Add trip plan
            </button>
            <button className="danger-button" type="button" onClick={handleDeleteAllRecords}>
              Delete all entries
            </button>
          </div>
        </div>

        {error && <p className="error-message">{error}</p>}
      </section>

      <section className="panel table-panel">
        <div className="table-header">
          <h2>Itinerary records</h2>
          <span className="page-label">
            Page {currentPage} of {totalPages}
          </span>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Destination</th>
                <th>Departure time</th>
                <th>Arrival time</th>
                <th>Means of transportation</th>
                <th>Transportation cost</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {!isLoading && paginatedItineraries.length > 0 ? (
                paginatedItineraries.map((itinerary) => (
                  <tr key={itinerary._id || `${itinerary.date}-${itinerary.destination}-${itinerary.departureTime}`}>
                    <td>{itinerary.date}</td>
                    <td>{itinerary.destination}</td>
                    <td>{itinerary.departureTime}</td>
                    <td>{itinerary.arrivalTime}</td>
                    <td>{itinerary.meansOfTransportation}</td>
                    <td>${Number(itinerary.transportationCost).toFixed(2)}</td>
                    <td className="action-cell">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="secondary-button small-button"
                          onClick={() => openEditModal(itinerary)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="danger-button small-button"
                          onClick={() => handleDeleteRecord(itinerary)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="empty-state">
                    {isLoading ? 'Loading itinerary entries...' : 'No itinerary entries saved yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && sortedItineraries.length > 0 && (
          <div className="pagination-row">
            <button
              type="button"
              className="secondary-button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              Previous
            </button>
            <span>{sortedItineraries.length} entries total</span>
            <button
              type="button"
              className="secondary-button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            >
              Next
            </button>
          </div>
        )}
      </section>

      <section className="panel totals-panel">
        <h2>Cost total per day</h2>
        <div className="totals-grid">
          {dailyTotals.length > 0 ? (
            dailyTotals.map(([date, total]) => (
              <div key={date} className="daily-total-card">
                <div className="daily-total-copy">
                  <span>{date}</span>
                  <strong>${Number(total).toFixed(2)}</strong>
                </div>
                <button
                  type="button"
                  className="danger-button small-button"
                  onClick={() => handleDeleteAllForDate(date)}
                >
                  Delete date
                </button>
              </div>
            ))
          ) : (
            <p className="empty-state-inline">No cost totals yet.</p>
          )}
        </div>
      </section>

      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Add trip details</h3>
              <button type="button" className="close-button" onClick={closeModal}>
                ×
              </button>
            </div>

            <label className="modal-date-field">
              <span>Date</span>
              <input
                type="date"
                value={modalDate}
                onChange={(event) => {
                  const nextDate = event.target.value
                  setModalDate(nextDate)
                  setModalRows((prevRows) =>
                    prevRows.map((row) => ({ ...row, date: nextDate })),
                  )
                }}
              />
            </label>

            {modalRows.map((row, index) => (
              <div key={`${row.date}-${index}`} className="modal-row">
                <div className="modal-row-header">
                  <h4>Row {index + 1}</h4>
                  {modalRows.length > 1 && (
                    <button type="button" className="remove-row-button" onClick={() => removeModalRow(index)}>
                      Remove
                    </button>
                  )}
                </div>

                <div className="field-grid modal-grid">
                  <label>
                    <span>Destination</span>
                    <input
                      type="text"
                      value={row.destination}
                      onChange={(event) => handleModalRowChange(index, 'destination', event.target.value)}
                      placeholder="City or country"
                    />
                  </label>

                  <label>
                    <span>Departure time</span>
                    <input
                      type="time"
                      value={row.departureTime}
                      onChange={(event) => handleModalRowChange(index, 'departureTime', event.target.value)}
                    />
                  </label>

                  <label>
                    <span>Arrival time</span>
                    <input
                      type="time"
                      value={row.arrivalTime}
                      onChange={(event) => handleModalRowChange(index, 'arrivalTime', event.target.value)}
                    />
                  </label>

                  <label>
                    <span>Means of transportation</span>
                    <select
                      value={row.meansOfTransportation}
                      onChange={(event) => handleModalRowChange(index, 'meansOfTransportation', event.target.value)}
                    >
                      <option value="Flight">Flight</option>
                      <option value="Train">Train</option>
                      <option value="Bus">Bus</option>
                      <option value="Car">Car</option>
                      <option value="Ship">Ship</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>

                  <label>
                    <span>Transportation cost</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.transportationCost}
                      onChange={(event) => handleModalRowChange(index, 'transportationCost', event.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                </div>
              </div>
            ))}

            <div className="daily-total-summary">
              <span>Daily total</span>
              <strong>
                ${
                  modalRows
                    .reduce((sum, row) => sum + Number(row.transportationCost || 0), 0)
                    .toFixed(2)
                }
              </strong>
            </div>

            {modalError && <p className="error-message">{modalError}</p>}

            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={addModalRow}>
                + Add row
              </button>
              <button type="button" className="primary-button" onClick={handleBatchSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Confirm entries'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && editForm && (
        <div className="modal-backdrop" onClick={closeEditModal}>
          <div className="modal-card small-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit itinerary</h3>
              <button type="button" className="close-button" onClick={closeEditModal}>
                ×
              </button>
            </div>

            <div className="field-grid modal-grid">
              <label>
                <span>Date</span>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(event) => handleEditFieldChange('date', event.target.value)}
                />
              </label>

              <label>
                <span>Destination</span>
                <input
                  type="text"
                  value={editForm.destination}
                  onChange={(event) => handleEditFieldChange('destination', event.target.value)}
                />
              </label>

              <label>
                <span>Departure time</span>
                <input
                  type="time"
                  value={editForm.departureTime}
                  onChange={(event) => handleEditFieldChange('departureTime', event.target.value)}
                />
              </label>

              <label>
                <span>Arrival time</span>
                <input
                  type="time"
                  value={editForm.arrivalTime}
                  onChange={(event) => handleEditFieldChange('arrivalTime', event.target.value)}
                />
              </label>

              <label>
                <span>Means of transportation</span>
                <select
                  value={editForm.meansOfTransportation}
                  onChange={(event) => handleEditFieldChange('meansOfTransportation', event.target.value)}
                >
                  <option value="Flight">Flight</option>
                  <option value="Train">Train</option>
                  <option value="Bus">Bus</option>
                  <option value="Car">Car</option>
                  <option value="Ship">Ship</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label>
                <span>Transportation cost</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.transportationCost}
                  onChange={(event) => handleEditFieldChange('transportationCost', event.target.value)}
                />
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={closeEditModal}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={handleEditSubmit}>
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default App
