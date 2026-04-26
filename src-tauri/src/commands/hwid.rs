use serde::Serialize;

#[derive(Serialize)]
pub struct HwidResponse {
    pub hwid: String,
}

#[tauri::command]
pub fn get_hwid() -> Result<HwidResponse, String> {
    let id = machine_uid::get().map_err(|e| format!("Failed to get HWID: {}", e))?;
    Ok(HwidResponse { hwid: id })
}
