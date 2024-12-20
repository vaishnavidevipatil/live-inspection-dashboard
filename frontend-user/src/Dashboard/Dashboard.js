import React, { useState, useRef, useEffect } from 'react';
import './Dashboard.css';
import logo from '../assets/FactreeLogo.png';
import name from '../assets/Factree Writing.png'
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import logout from'../assets/logout.png'


function LiveInspection() {
  const [cameraFeeds, setCameraFeeds] = useState(Array(6).fill(null));
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uniquePartId, setUniquePartId] = useState('');
  const [videoSrc, setVideoSrc] = useState(null)
  const [defects, setDefects] = useState([]);
  const [summary, setSummary] = useState([]);
  const [imageUrls, setImageUrls] = useState(null);
  const [accept, setaccept] = useState(false);
  const [parts, setParts] = useState([]);
  const [stations, setStations] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedStation, setSelectedStation] = useState('');
  const [showWarning, setShowWarning] = useState(false);
  const [statusColor, setStatusColor] = useState('#800080'); // Purple as default

  const thumbnailsRefs = useRef(Array(6).fill(null));
  useEffect(() => {
    // Fetch parts data
    axios.get('http://localhost:5002/api/parts')
      .then(response => {
        setParts(response.data); // Assuming response.data contains an array of parts
      })
      .catch(error => {
        console.error('Error fetching parts:', error);
      });

    // Fetch stations data
    axios.get('http://localhost:5002/api/station')
      .then(response => {
        setStations(response.data); // Assuming response.data contains an array of stations
      })
      .catch(error => {
        console.error('Error fetching stations:', error);
      });
  }, []);

  const handleStart = async () => {
    // Check if both product and station are selected
    if (!selectedProduct || !selectedStation) {
      setShowWarning(true);
      return;
    }

    const newUniquePartId = uuidv4();
    setUniquePartId(newUniquePartId);

    try {
      const response = await fetch('http://127.0.0.1:5000/start_process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          part_id: newUniquePartId,
          part_name: selectedProduct,
        }),
      });
      const data = await response.json();

      // Set video source with part_id, selectedProduct, and selectedStation included in the URL
      setVideoSrc(`http://127.0.0.1:5000/video_feed?part_id=${newUniquePartId}&part_name=${selectedProduct}&station=${selectedStation}`);
      setIsStreaming(true);
    } catch (error) {
      console.error("Error starting process: ", error);
    }
  };

  const handleCloseWarning = () => {
    setShowWarning(false);
  };

  const handleStop = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5000/stop_process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          part_id: uniquePartId,
        }),
        mode: 'no-cors'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
    } catch (error) {
      console.error("Error stopping process: ", error);
    } finally {
      setVideoSrc(null);
      setIsStreaming(false);
    }
    window.location.reload();
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchInspectionData = async () => {
    try {
      // Fetch defects data
      const defectResponse = await fetch(`http://127.0.0.1:5002/api/defects?part_id=${uniquePartId}`);
      if (!defectResponse.ok) {
        throw new Error(`Error fetching defects: ${defectResponse.status}`);
      }
      const defects = await defectResponse.json();
      setDefects(defects);

      // Fetch summary data
      const summaryResponse = await fetch(`http://127.0.0.1:5002/api/summary?part_id=${uniquePartId}`);
      if (!summaryResponse.ok) {
        throw new Error(`Error fetching summary: ${summaryResponse.status}`);
      }

      const accept = await fetch(`http://127.0.0.1:5002/api/accept?part_id=${uniquePartId}`)
      if (accept.ok) {
        setaccept(await accept.json());
      }

      const summary = await summaryResponse.json();
      setSummary(summary);

      // Fetch latest image URLs
      const imageResponse = await fetch(`http://127.0.0.1:5000/get_images?part_id=${uniquePartId}`);
      if (!imageResponse.ok) {
        throw new Error(`Error fetching images: ${imageResponse.status}`);
      }
      const imageData = await imageResponse.json();

      if (imageData.image_urls && imageData.image_urls.length > 0) {
        setImageUrls([]); // Reset imageUrls state first
        setImageUrls(imageData.image_urls); // Update with new image URLs
      } else {
        console.error('No images found');
      }
    } catch (error) {
      console.error('Error during inspection process:', error);
    }
    finally {
      setIsLoading(false);
    }
  };

  // UseEffect to handle the data fetching when the component is mounted or `isStreaming` changes
  useEffect(() => {
    if (isStreaming) {
      const intervalId = setInterval(() => {
        fetchInspectionData();
      }, 500); // Polling every 5 seconds (you can adjust the interval)

      return () => clearInterval(intervalId); // Clear the interval on component unmount
    }
  }, [isStreaming, uniquePartId]);


  const handleCheck = async () => {
    setIsLoading(true);
    try {
      // Start inspection
      fetch(`http://127.0.0.1:5000/inspect_func`, {
        mode: 'no-cors',  // Adjust this as needed based on your CORS policy
      });

    } catch (error) {
      console.error('Error during inspection process:', error);
    }
  };

  const handleProductChange = (event) => {
    setSelectedProduct(event.target.value);
  };

  const handleStationChange = (event) => {
    setSelectedStation(event.target.value);
  };

  const acceptanceStatus = accept && accept.length > 0 ? accept[0] : null;
  const acceptanceLabel = acceptanceStatus === null ? 'WAITING FOR INSPECTION' : acceptanceStatus.is_accepted === 1 ? 'ACCEPTED' : 'REJECTED';
 // Add this useEffect to handle color changes
  useEffect(() => {
    if (acceptanceStatus === null) {
      setStatusColor('#800080'); // Purple for WAITING
    } else if (acceptanceStatus.is_accepted === 1) {
      setStatusColor('green'); // Green for ACCEPTED
    } else {
      setStatusColor('red'); // Red for REJECTED
    }
  }, [acceptanceStatus]);

  const [metrologyData, setMetrologyData] = useState(
    Array(20).fill({
      measured: 0,
      isPass: null, // null to indicate no result yet
    })
  );

  const handleInspect = () => {
    // Update the metrology data with new random values and pass/fail logic
    const updatedData = metrologyData.map(() => {
      const randomMeasured = parseFloat((Math.random() * 100).toFixed(2)); // Random measured value
      const isPass = Math.abs(randomMeasured - 50) <= 2; // Check if within 50.00 ±2 specification
      return {
        measured: randomMeasured,
        isPass,
      };
    });
    setMetrologyData(updatedData); // Update state with new data
  };
  
  const handleBoth = () => {
    handleCheck(); // Ensure this is a function and properly defined
    handleInspect(); // Ensure this is a function and properly defined
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    sessionStorage.clear();
    window.history.replaceState(null, "", "/");
    window.location.href = "/";
  };

  return (
    <div className="live-inspection-page">
      {/* Live Inspection Header */}
      <header className="inspection-header">
        <div className="factree-logo">
          <img src={logo} alt="Factree Logo" />
          <img src={name} alt="Factree" />
        </div>
        <h1 className="live-inspection-title">Live Inspection</h1>
        <button onClick={handleLogout} style={{height:'40px', fontSize:'17px', marginRight:'-110px', borderRadius:'25px'}} className="logout-button">
          <img style={{height:'35px', borderRadius:'200px'}} src={logout}></img>
        </button>
      </header>
      {/* Top bar for selection and controls */}
      <div className="top-bar">
        <div className="factree-section">
          {/* Moved Variant and Station Selectors below the logo */}
          <div className="selectors-buttons">
            <div className="selectors">
              <select value={selectedProduct} onChange={handleProductChange}>
                <option value="">Select Product</option>
                {parts.map((part) => (
                  <option key={part.id} value={part.product_name}>
                    {part.product_name}
                  </option>
                ))}
              </select>

              {/* Station dropdown */}
              <select value={selectedStation} onChange={handleStationChange}>
                <option value="">Select Station</option>
                {stations.map((station) => (
                  <option key={station.id} value={station.station_name}>
                    {station.station_name}
                  </option>
                ))}
              </select>
            </div>
            {/* Controls buttons */}
            <div className="controls-buttons">
              <button type="button" className="btn btn-primary" onClick={handleStart} disabled={isStreaming}>START</button>
              <button type="button" className="btn btn-primary" onClick={handleBoth}  disabled={!isStreaming}>INSPECT</button>
              <button type="button" className="btn btn-danger"  onClick={handleStop}   disabled={!isStreaming}>STOP</button>
            </div>
            {isLoading && (
            <button class="btn btn-primary" type="button" disabled style={{ marginLeft: '60px' }}>
              <span class="spinner-grow spinner-grow-sm" role="status" aria-hidden="true"></span>
              Loading...
            </button>
            )}
          </div>
        </div>
        {/* Inspector, Batch ID, Camera Health, PLC Health */}
        <div className="controls-section">
          {/* Inspector and Batch ID in one box */}
          <div className="status-info">
            <div className="status-item">
              <label>Inspector  &nbsp;&nbsp;:&nbsp;&nbsp;</label>
              <span> Inspector 1</span>
            </div>
            <div className="status-item">
              <label>Batch ID   &nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;</label>
              <span> Batch 1</span>
            </div>
          </div>

          {/* Health statuses in another box */}
          <div className="health-statuses">
            <div className="health-status1">
              <div className="health-status-label">Camera Health&nbsp;&nbsp;:</div>
              <div className="status-circle1"></div>
            </div>
            <div className="health-status2">
              <div className="health-status-label">PLC Health&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; :</div>
              <div className="status-circle2"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main inspection area */}
      <div className="main-inspection-area">
        {/* Camera and defect section */}
        <div className="camera-feed">
          <strong><span>LIVE</span></strong>
          
          <div className="camera-header">
            <img src={videoSrc} style={{ width: '700px', height: '350px' }} />
          </div>
        </div>

        <div className="camera-thumbnails">
          {Array(6)
            .fill(null) // Create an array with 6 items
            .map((_, index) => (
              <div key={index} className="camera-thumbnail">
                {/* If there's an image URL, display the image; otherwise, show a placeholder */}
                {imageUrls && imageUrls[index] ? (
                  <img
                    src={imageUrls[index]}
                    alt={`Image ${index + 1}`}
                    className="image-box-img"
                    style={{ width: '131px', marginTop: '10px' }}
                  />
                ) : (
                  <div className="placeholder" style={{ width: '131px', height: '110px', backgroundColor: '#e0e0e0' }}>
                    {/* Optionally, you can add text or an icon to indicate an empty space */}
                    <span style={{ textAlign: 'center', display: 'block', lineHeight: '131px' }}>No Image</span>
                  </div>
                )}
              </div>
            ))}
        </div>


        {/* Defect classification, metrology, and summary section */}
        <div className="side-panel">
          {/* Defect classification table */}
          {/* Defect classification table */}
          <div className="defect-classification">
            <h2 style={{ marginTop: '15px' }}>Defect Classification</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Defect</th>
                    <th>Confidence Score</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {defects.length > 0 ? (
                    defects.map((defect, i) => {
                      const defectData = defect.defect_list.split(', ').map(item => {
                        // Split each item by space, but ensure the last part is the score
                        const parts = item.split(' ');
                        const score = parseFloat(parts.pop()); // Take the last element as the score
                        const defectType = parts.join(' '); // Join the rest as the defect type

                        // Calculate percentage only if the score is a valid number
                        const percentage = isNaN(score) ? 'N/A' : (score * 100).toFixed(2);

                        return {
                          defect_type: defectType,
                          count: score.toFixed(2),
                          percentage: percentage
                        };
                      });

                      return defectData.map((def, j) => (
                        <tr key={`${i}-${j}`}>
                          <td>{def.defect_type}</td>
                          <td>{def.count}</td>
                          <td>{def.percentage}%</td>
                        </tr>
                      ));
                    })
                  ) : (
                    <tr>
                      <td colSpan="3">Loading defects...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Metrology table */}
          <div className="metrology">
            <h2 style={{ marginTop: '5px' }}>Metrology</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Measured</th>
                    <th>Specification</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                {['Height', 'Width', 'Dia'].map((parameter, i) => (
                  <tr key={i}>
                    <td>{parameter}</td>
                    <td>{metrologyData[i]?.measured?.toFixed(2) || '0'} mm</td>
                    <td>50.00 ±2</td>
                    <td className={metrologyData[i]?.isPass === true ? 'pass' : 'error'}>
                      {metrologyData[i]?.isPass === null
                        ? ''
                        : metrologyData[i]?.isPass
                        ? '✔'
                        : '✖'}
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary section */}
          <div className="summary">
            <h2 style={{ marginTop: '5px' }}>Summary</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Defect</th>
                    <th>Count</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Total Accepted</td>
                    <td>{summary.totalAccepted}</td>
                    <td>{((summary.totalAccepted / summary.totalInspected) * 100).toFixed(2)}%</td>
                  </tr>
                  <tr>
                    <td>Total Non Accepted</td>
                    <td>{summary.totalNonAccepted}</td>
                    <td>{((summary.totalNonAccepted / summary.totalInspected) * 100).toFixed(2)}%</td>
                  </tr>
                  <tr>
                    <td>Total Inspected</td>
                    <td>{summary.totalInspected}</td>
                    <td>100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="bottom-section">
      <div className="bottom-box-wrapper">
      <div className="bottom-box">
      {defects.length > 0 ? (
        defects.map((defect, i) => {
          
          const displayText = acceptanceLabel === 'ACCEPTED' ? 'No Defect' : 'Mobile Phone';         
          return (
            <p key={i} style={{ marginTop:'-10px'}} >
              Defect: {displayText}
            </p>
          );
        })
      ) : (
        <p style={{marginTop:'-10px'}} >Loading defects...</p>
      )}
    </div>

          <div
            style={{
              color: 'white',
              fontWeight: 'bold',
              backgroundColor: statusColor,
              padding: '10px',
              borderRadius: '5px',
              textAlign: 'center',
              height: '60px',
              width: '755px',
              fontSize: '25px'
            }}
          >
            {acceptanceLabel}
          </div>
        </div>


        <div className="additional-box">
          <strong><p className="additional-text">OCR</p></strong>
          <p className="additional-text">Batch&nbsp;&nbsp;&nbsp;-</p>
          <p className="additional-text">Exp&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-</p>
        </div>
      </div>
      {showWarning && (
      <div className="warning-overlay">
        <div className="warning-content">
          <h3>Warning!</h3>
          <p>Please select both Product and Station before starting.</p>
          <button onClick={handleCloseWarning} className="btn btn-primary">
            OK
          </button>
        </div>
      </div>
    )}
    </div>
  );
}

export default LiveInspection;
