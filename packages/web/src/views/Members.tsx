import { 
  Table, 
  Button, 
  Heading, 
  HStack, 
  IconButton, 
  Stack, 
  Text, 
  Box,
  Flex,
  Spinner,
  Center,
  Input
} from "@chakra-ui/react";
import { LuPlus, LuPencil, LuTrash2, LuRefreshCw, LuBan, LuFileText, LuDollarSign } from "react-icons/lu";
import { useEffect, useState } from "react";
import { membersService } from "../services/members";
import { disciplinesService } from "../services/disciplines";
import { paymentsService } from "../services/payments";
import type { MemberDTO, CreateMemberRequest, UpdateMemberRequest, MemberCategory, MemberStatus, CreateDisciplineRequest, CreateMedicalCertificateRequest, CreatePaymentRequest } from "@alentapp/shared";
import { 
  DialogRoot, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogBody, 
  DialogFooter, 
  DialogActionTrigger,
  DialogCloseTrigger
} from "../components/ui/dialog";
import { Field } from "../components/ui/field";
import { 
  SelectRoot, 
  SelectTrigger, 
  SelectValueText, 
  SelectContent, 
  SelectItem, 
  createListCollection 
} from "../components/ui/select";

const categories = createListCollection({
  items: [
    { label: "Pleno", value: "Pleno" },
    { label: "Cadete", value: "Cadete" },
    { label: "Honorario", value: "Honorario" },
  ],
});

const statusCategories = createListCollection({
  items: [
    { label: "Activo", value: "Activo" },
    { label: "Moroso", value: "Moroso" },
    { label: "Suspendido", value: "Suspendido" },
  ],
});

export function MembersView() {
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for the modal
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [isDisciplineDialogOpen, setIsDisciplineDialogOpen] = useState(false);
  const [selectedMemberForDiscipline, setSelectedMemberForDiscipline] = useState<MemberDTO | null>(null);
  const [isSubmittingDiscipline, setIsSubmittingDiscipline] = useState(false);

  const [isMedicalCertDialogOpen, setIsMedicalCertDialogOpen] = useState(false);
  const [selectedMemberForMedicalCert, setSelectedMemberForMedicalCert] = useState<MemberDTO | null>(null);
  const [isSubmittingMedicalCert, setIsSubmittingMedicalCert] = useState(false);
  const [editingMedicalCertId, setEditingMedicalCertId] = useState<string | null>(null);

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedMemberForPayment, setSelectedMemberForPayment] = useState<MemberDTO | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateMemberRequest & { status?: MemberStatus }>({
    name: "",
    dni: "",
    email: "",
    birthdate: "",
    category: "Pleno",
  });
  const [disciplineFormData, setDisciplineFormData] = useState<CreateDisciplineRequest>({
    member_id: "",
    reason: "",
    start_date: "",
    end_date: "",
    is_total_suspension: false,
  });

  const [medicalCertFormData, setMedicalCertFormData] = useState<CreateMedicalCertificateRequest>({
    member_id: "",
    issue_date: "",
    expiry_date: "",
    doctor_license: "",
  });

  const [paymentFormData, setPaymentFormData] = useState<CreatePaymentRequest>({
    member_id: "",
    amount: 0,
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    due_date: "",
  });

  const fetchMembers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await membersService.getAll();
      setMembers(data);
    } catch (err: any) {
      setError(err.message || "Error al cargar los miembros");
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingMemberId(null);
    setFormData({ name: "", dni: "", email: "", birthdate: "", category: "Pleno" });
    setIsDialogOpen(true);
  };

  const openEditModal = (member: MemberDTO) => {
    setEditingMemberId(member.id);
    setFormData({
      name: member.name,
      dni: member.dni,
      email: member.email,
      birthdate: member.birthdate,
      category: member.category,
      status: member.status,
    });
    setIsDialogOpen(true);
  };

  const openDisciplineModal = (member: MemberDTO) => {
    setSelectedMemberForDiscipline(member);
    setDisciplineFormData({
      member_id: member.id,
      reason: "",
      start_date: "",
      end_date: "",
      is_total_suspension: false,
    });
    setIsDisciplineDialogOpen(true);
  };

  const openMedicalCertModal = (member: MemberDTO) => {
    setEditingMedicalCertId(null);
    setSelectedMemberForMedicalCert(member);
    setMedicalCertFormData({
      member_id: member.id,
      issue_date: "",
      expiry_date: "",
      doctor_license: "",
    });
    setIsMedicalCertDialogOpen(true);
  };

  const openPaymentModal = (member: MemberDTO) => {
    setSelectedMemberForPayment(member);
    setPaymentFormData({
      member_id: member.id,
      amount: 0,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      due_date: "",
    });
    setIsPaymentDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingMemberId) {
        await membersService.update(editingMemberId, formData as UpdateMemberRequest);
      } else {
        await membersService.create(formData as CreateMemberRequest);
      }
      setIsDialogOpen(false);
      fetchMembers(); // Refresh the list
    } catch (err: any) {
      alert(err.message || "Error al guardar el miembro");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMember = async (id: string, name: string) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar al miembro "${name}"? Esta acción no se puede deshacer.`)) {
      try {
        await membersService.delete(id);
        fetchMembers(); // Refresh the list
      } catch (err: any) {
        alert(err.message || "Error al eliminar el miembro");
      }
    }
  };

  const handleDisciplineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingDiscipline(true);
    try {
      await disciplinesService.create(disciplineFormData);
      setIsDisciplineDialogOpen(false);
      setSelectedMemberForDiscipline(null);
      fetchMembers();
    } catch (err: any) {
      alert(err.message || "Error al registrar la disciplina");
    } finally {
      setIsSubmittingDiscipline(false);
    }
  };

  const handleMedicalCertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingMedicalCert(true);
    try {
      if (editingMedicalCertId) {
        await medicalCertificatesService.update(editingMedicalCertId, {
            issue_date: medicalCertFormData.issue_date,
            expiry_date: medicalCertFormData.expiry_date,
            doctor_license: medicalCertFormData.doctor_license,
        });
        alert("Certificado médico actualizado correctamente.");
      } else {
        await medicalCertificatesService.create(medicalCertFormData);
        alert("Certificado médico registrado correctamente.");
      }
      setIsMedicalCertDialogOpen(false);
      setSelectedMemberForMedicalCert(null);
      setEditingMedicalCertId(null);
    } catch (err: any) {
      alert(err.message || "Error al registrar el certificado");
    } finally {
      setIsSubmittingMedicalCert(false);
    }
  };

  const handleDeleteMedicalCert = async (id: string) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar este certificado médico? Esta acción no se puede deshacer.")) {
      try {
        await medicalCertificatesService.delete(id);
        alert("Certificado médico eliminado correctamente.");
      } catch (err: any) {
        alert(err.message || "Error al eliminar el certificado médico");
      }
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingPayment(true);
    try {
      await paymentsService.create(paymentFormData);
      alert("Pago registrado correctamente.");
      setIsPaymentDialogOpen(false);
      setSelectedMemberForPayment(null);
    } catch (err: any) {
      alert(err.message || "Error al registrar el pago");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  return (
  <>
    <DialogRoot open={isDialogOpen} onOpenChange={(e) => setIsDialogOpen(e.open)}>
      <Stack gap="8">
        <Flex justify="space-between" align="center">
          <Stack gap="1">
            <Heading size="2xl" fontWeight="bold">Administración de Miembros</Heading>
            <Text color="fg.muted" fontSize="md">
              Gestiona los accesos y roles de los integrantes de Alentapp.
            </Text>
          </Stack>
          <HStack gap="3">
            <Button variant="outline" onClick={fetchMembers} disabled={isLoading}>
              <LuRefreshCw /> Actualizar
            </Button>
            <Button colorPalette="blue" size="md" onClick={openCreateModal}>
              <LuPlus /> Agregar Miembro
            </Button>
          </HStack>
        </Flex>

        {/* Modal para agregar/editar miembro */}
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingMemberId ? "Editar Miembro" : "Agregar Nuevo Miembro"}</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Stack gap="4">
                <Field label="Nombre Completo" required>
                  <Input 
                    placeholder="Ej. Juan Pérez" 
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </Field>
                <Field label="DNI" required>
                  <Input 
                    placeholder="Ej. 12345678" 
                    value={formData.dni}
                    onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Correo Electrónico" required>
                  <Input 
                    type="email" 
                    placeholder="ejemplo@correo.com" 
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Fecha de Nacimiento" required>
                  <Input 
                    type="date" 
                    value={formData.birthdate}
                    onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Categoría" required>
                  <SelectRoot 
                    collection={categories} 
                    value={[formData.category]}
                    onValueChange={(e) => setFormData({ ...formData, category: e.value[0] as MemberCategory })}
                  >
                    <SelectTrigger>
                      <SelectValueText placeholder="Seleccione una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.items.map((cat) => (
                        <SelectItem item={cat} key={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </SelectRoot>
                </Field>
                
                {editingMemberId && formData.status && (
                  <Field label="Estado" required>
                    <SelectRoot 
                      collection={statusCategories} 
                      value={[formData.status]}
                      onValueChange={(e) => setFormData({ ...formData, status: e.value[0] as MemberStatus })}
                    >
                      <SelectTrigger>
                        <SelectValueText placeholder="Seleccione el estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusCategories.items.map((stat) => (
                          <SelectItem item={stat} key={stat.value}>
                            {stat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </SelectRoot>
                  </Field>
                )}
              </Stack>
            </DialogBody>
            <DialogFooter>
              <DialogActionTrigger asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogActionTrigger>
              <Button type="submit" colorPalette="blue" loading={isSubmitting}>
                {editingMemberId ? "Guardar Cambios" : "Crear Miembro"}
              </Button>
            </DialogFooter>
            <DialogCloseTrigger />
          </form>
        </DialogContent>

      {error && (
        <Box p="4" bg="red.50" color="red.700" borderRadius="md" border="1px solid" borderColor="red.200">
          <Text fontWeight="bold">Error:</Text>
          <Text>{error}</Text>
        </Box>
      )}

      <Box 
        bg="bg.panel" 
        borderRadius="xl" 
        boxShadow="sm" 
        borderWidth="1px" 
        overflow="hidden"
        minH="300px"
        position="relative"
      >
        {isLoading ? (
          <Center h="300px">
            <Stack align="center" gap="4">
              <Spinner size="xl" color="blue.500" />
              <Text color="fg.muted">Cargando miembros...</Text>
            </Stack>
          </Center>
        ) : members.length === 0 ? (
          <Center h="300px">
            <Stack align="center" gap="4">
              <Text color="fg.muted">No se encontraron miembros.</Text>
              <Button variant="ghost" onClick={fetchMembers}>Reintentar</Button>
            </Stack>
          </Center>
        ) : (
          <Table.Root size="md" variant="line" interactive>
            <Table.Header>
              <Table.Row bg="bg.muted/50">
                <Table.ColumnHeader py="4">Nombre</Table.ColumnHeader>
                <Table.ColumnHeader py="4">DNI</Table.ColumnHeader>
                <Table.ColumnHeader py="4">Correo</Table.ColumnHeader>
                <Table.ColumnHeader py="4">Nacimiento</Table.ColumnHeader>
                <Table.ColumnHeader py="4">Categoría</Table.ColumnHeader>
                <Table.ColumnHeader py="4">Estado</Table.ColumnHeader>
                <Table.ColumnHeader py="4" textAlign="end">Acciones</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {members.map((member) => (
                <Table.Row key={member.id} _hover={{ bg: "bg.muted/30" }}>
                  <Table.Cell fontWeight="semibold" color="fg.emphasized">
                    {member.name}
                  </Table.Cell>
                  <Table.Cell color="fg.muted">{member.dni}</Table.Cell>
                  <Table.Cell color="fg.muted">{member.email}</Table.Cell>
                  <Table.Cell color="fg.muted">{member.birthdate}</Table.Cell>
                  <Table.Cell>
                    <Box 
                      display="inline-block" 
                      px="2" 
                      py="0.5" 
                      borderRadius="md" 
                      bg="blue.50" 
                      color="blue.700" 
                      fontSize="xs" 
                      fontWeight="bold"
                    >
                      {member.category}
                    </Box>
                  </Table.Cell>
                  <Table.Cell>
                    <Box 
                      display="inline-block" 
                      px="2" 
                      py="0.5" 
                      borderRadius="md" 
                      bg={member.status === 'Activo' ? 'green.50' : 'orange.50'} 
                      color={member.status === 'Activo' ? 'green.700' : 'orange.700'} 
                      fontSize="xs" 
                      fontWeight="bold"
                    >
                      {member.status}
                    </Box>
                  </Table.Cell>
                  <Table.Cell textAlign="end">
                    <HStack gap="2" justify="flex-end">
                      <IconButton
                        variant="ghost"
                        size="sm"
                        colorPalette="blue"
                        aria-label="Registrar certificado médico"
                        onClick={() => openMedicalCertModal(member)}
                      >
                        <LuFileText />
                      </IconButton>
                      <IconButton
                        variant="ghost"
                        size="sm"
                        colorPalette="green"
                        aria-label="Registrar pago"
                        onClick={() => openPaymentModal(member)}
                      >
                        <LuDollarSign />
                      </IconButton>
                      <IconButton
                        variant="ghost"
                        size="sm"
                        colorPalette="orange"
                        aria-label="Registrar disciplina"
                        onClick={() => openDisciplineModal(member)}
                      >
                        <LuBan />
                      </IconButton>
                      <IconButton 
                        variant="ghost" 
                        size="sm" 
                        aria-label="Editar miembro"
                        onClick={() => openEditModal(member)}
                      >
                        <LuPencil />
                      </IconButton>
                      <IconButton 
                        variant="ghost" 
                        size="sm" 
                        colorPalette="red" 
                        aria-label="Eliminar miembro"
                        onClick={() => handleDeleteMember(member.id, member.name)}
                      >
                        <LuTrash2 />
                      </IconButton>
                    </HStack>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Box>
    </Stack>
  </DialogRoot>
  <DialogRoot open={isDisciplineDialogOpen} onOpenChange={(e) => setIsDisciplineDialogOpen(e.open)}>
    <DialogContent>
      <form onSubmit={handleDisciplineSubmit}>
        <DialogHeader>
          <DialogTitle>
            Registrar Disciplina
            {selectedMemberForDiscipline ? ` - ${selectedMemberForDiscipline.name}` : ""}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Stack gap="4">
            <Field label="Motivo" required>
              <Input
                placeholder="Ej. Incumplimiento del reglamento"
                value={disciplineFormData.reason}
                onChange={(e) => setDisciplineFormData({ ...disciplineFormData, reason: e.target.value })}
                required
              />
            </Field>
            <Field label="Fecha de Inicio" required>
              <Input
                type="datetime-local"
                value={disciplineFormData.start_date}
                onChange={(e) => setDisciplineFormData({ ...disciplineFormData, start_date: e.target.value })}
                required
              />
            </Field>
            <Field label="Fecha de Fin" required>
              <Input
                type="datetime-local"
                value={disciplineFormData.end_date}
                onChange={(e) => setDisciplineFormData({ ...disciplineFormData, end_date: e.target.value })}
                required
              />
            </Field>
            <Field label="Suspensión total">
              <label>
                <input
                  type="checkbox"
                  checked={disciplineFormData.is_total_suspension}
                  onChange={(e) =>
                    setDisciplineFormData({
                      ...disciplineFormData,
                      is_total_suspension: e.target.checked,
                    })
                  }
                />{" "}
                Suspende totalmente al socio mientras la disciplina esté activa
              </label>
            </Field>
          </Stack>
        </DialogBody>
        <DialogFooter>
          <DialogActionTrigger asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogActionTrigger>
          <Button type="submit" colorPalette="blue" loading={isSubmittingDiscipline}>
            Registrar Disciplina
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </form>
    </DialogContent>
  </DialogRoot>

  <DialogRoot open={isMedicalCertDialogOpen} onOpenChange={(e) => setIsMedicalCertDialogOpen(e.open)}>
    <DialogContent>
      <form onSubmit={handleMedicalCertSubmit}>
        <DialogHeader>
          <DialogTitle>
            {editingMedicalCertId ? "Actualizar Certificado Médico" : "Registrar Certificado Médico"}
            {selectedMemberForMedicalCert ? ` - ${selectedMemberForMedicalCert.name}` : ""}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          {!editingMedicalCertId && (
            <Box bg="orange.100" p={3} borderRadius="md" mb={4} borderLeftWidth="4px" borderLeftColor="orange.500">
              <Text fontWeight="bold" color="orange.800" fontSize="sm">
                  ⚠️ Atención
              </Text>
              <Text color="orange.800" mt={1} fontSize="sm">
                  Cualquier certificado previo activo quedará automáticamente invalidado.
              </Text>
            </Box>
          )}
          <Stack gap="4">
            <Field label="Fecha de Emisión" required>
              <Input
                type="date"
                value={medicalCertFormData.issue_date}
                onChange={(e) => setMedicalCertFormData({ ...medicalCertFormData, issue_date: e.target.value })}
                required
              />
            </Field>
            <Field label="Fecha de Vencimiento" required>
              <Input
                type="date"
                value={medicalCertFormData.expiry_date}
                onChange={(e) => setMedicalCertFormData({ ...medicalCertFormData, expiry_date: e.target.value })}
                required
              />
            </Field>
            <Field label="Matrícula del Médico" required>
              <Input
                placeholder="Ej: MN 12345"
                value={medicalCertFormData.doctor_license}
                onChange={(e) => setMedicalCertFormData({ ...medicalCertFormData, doctor_license: e.target.value })}
                required
              />
            </Field>
          </Stack>
        </DialogBody>
        <DialogFooter>
          <DialogActionTrigger asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogActionTrigger>
          <Button type="submit" colorPalette="blue" loading={isSubmittingMedicalCert}>
            {editingMedicalCertId ? "Actualizar Certificado" : "Registrar Certificado"}
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </form>
    </DialogContent>
  </DialogRoot>

  <DialogRoot open={isPaymentDialogOpen} onOpenChange={(e) => setIsPaymentDialogOpen(e.open)}>
    <DialogContent>
      <form onSubmit={handlePaymentSubmit}>
        <DialogHeader>
          <DialogTitle>
            Registrar Pago
            {selectedMemberForPayment ? ` - ${selectedMemberForPayment.name}` : ""}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Stack gap="4">
            <Field label="Monto" required>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Ej. 1500.50"
                value={paymentFormData.amount || ""}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: parseFloat(e.target.value) })}
                required
              />
            </Field>
            <Field label="Mes" required>
              <Input
                type="number"
                min="1"
                max="12"
                placeholder="Ej. 5"
                value={paymentFormData.month || ""}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, month: parseInt(e.target.value, 10) })}
                required
              />
            </Field>
            <Field label="Año" required>
              <Input
                type="number"
                min="2000"
                max="2100"
                placeholder="Ej. 2026"
                value={paymentFormData.year || ""}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, year: parseInt(e.target.value, 10) })}
                required
              />
            </Field>
            <Field label="Fecha de Vencimiento" required>
              <Input
                type="date"
                value={paymentFormData.due_date}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, due_date: e.target.value })}
                required
              />
            </Field>
          </Stack>
        </DialogBody>
        <DialogFooter>
          <DialogActionTrigger asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogActionTrigger>
          <Button type="submit" colorPalette="blue" loading={isSubmittingPayment}>
            Registrar Pago
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </form>
    </DialogContent>
  </DialogRoot>
  </>
);
}
