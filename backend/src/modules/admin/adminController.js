import * as adminService from "./adminService.js";

function handleError(res, error) {
  res.status(400).json({ error: error.message });
}

export async function getAdminOverview(req, res) {
  try {
    const data = await adminService.getOverview(req.user);
    res.json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function listUsers(req, res) {
  try {
    const data = await adminService.listUsers(req.user);
    res.json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function createUser(req, res) {
  try {
    const data = await adminService.createUser(req.user, req.body);
    res.status(201).json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function updateUser(req, res) {
  try {
    const data = await adminService.updateUser(req.user, req.params.id, req.body);
    res.json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function setUserStatus(req, res) {
  try {
    const data = await adminService.setUserStatus(req.user, req.params.id, req.body.active);
    res.json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function deleteUser(req, res) {
  try {
    await adminService.deleteUser(req.user, req.params.id);
    res.sendStatus(204);
  } catch (error) {
    handleError(res, error);
  }
}

export async function resetUserPassword(req, res) {
  try {
    await adminService.resetUserPassword(req.user, req.params.id, req.body.password);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error);
  }
}

export async function listAdmins(req, res) {
  try {
    const data = await adminService.listAdmins(req.user);
    res.json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function createAdmin(req, res) {
  try {
    const data = await adminService.createAdmin(req.user, req.body);
    res.status(201).json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function updateAdmin(req, res) {
  try {
    const data = await adminService.updateAdmin(req.user, req.params.id, req.body);
    res.json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function setAdminStatus(req, res) {
  try {
    const data = await adminService.setAdminStatus(req.user, req.params.id, req.body.active);
    res.json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function deleteAdmin(req, res) {
  try {
    await adminService.deleteAdmin(req.user, req.params.id);
    res.sendStatus(204);
  } catch (error) {
    handleError(res, error);
  }
}

export async function resetAdminPassword(req, res) {
  try {
    await adminService.resetAdminPassword(req.user, req.params.id, req.body.password);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error);
  }
}

export async function listDepartments(req, res) {
  try {
    const data = await adminService.listDepartments(req.user);
    res.json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function createDepartment(req, res) {
  try {
    const data = await adminService.createDepartment(req.user, req.body);
    res.status(201).json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function updateDepartment(req, res) {
  try {
    const data = await adminService.updateDepartment(req.user, req.params.id, req.body);
    res.json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function deleteDepartment(req, res) {
  try {
    await adminService.deleteDepartment(req.user, req.params.id);
    res.sendStatus(204);
  } catch (error) {
    handleError(res, error);
  }
}

export async function createCompany(req, res) {
  try {
    const data = await adminService.createCompany(req.user, req.body);
    res.status(201).json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function deleteCompany(req, res) {
  try {
    await adminService.deleteCompany(req.user, req.params.id);
    res.sendStatus(204);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getSettings(req, res) {
  try {
    const data = await adminService.getSettings(req.user);
    res.json(data);
  } catch (error) {
    handleError(res, error);
  }
}

export async function listSystemLogs(req, res) {
  try {
    const data = await adminService.listSystemLogs(req.user);
    res.json(data);
  } catch (error) {
    handleError(res, error);
  }
}
