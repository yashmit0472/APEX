import re

with open('test/AgentSpendingVault.t.sol', 'r') as f:
    content = f.read()

# Add imports
if 'PaymentEscrow' not in content:
    content = content.replace('import {StakeManager} from "../src/StakeManager.sol";', 'import {StakeManager} from "../src/StakeManager.sol";\nimport {PaymentEscrow} from "../src/PaymentEscrow.sol";\nimport {DeliveryVerifier} from "../src/DeliveryVerifier.sol";')

# Add storage variables
if 'PaymentEscrow internal escrow;' not in content:
    content = content.replace('AgentSpendingVault internal vault;', 'AgentSpendingVault internal vault;\n    PaymentEscrow internal escrow;\n    DeliveryVerifier internal verifier;\n    address internal treasury = address(0x999);')

# Setup deployments
setup_repl = '''
        // -------------------------------------------------
        // 3. Deploy StakeManager
        // -------------------------------------------------
        stakeManager = new StakeManager(owner, address(usdc), address(registry), MINIMUM_STAKE);

        verifier = new DeliveryVerifier();
        escrow = new PaymentEscrow(owner, address(usdc), address(registry), address(stakeManager), address(verifier), treasury);

        // -------------------------------------------------
'''
content = content.replace('''
        // -------------------------------------------------
        // 3. Deploy StakeManager
        // -------------------------------------------------
        stakeManager = new StakeManager(owner, address(usdc), address(registry), MINIMUM_STAKE);

        // -------------------------------------------------
'''.strip(), setup_repl.strip())

# Setup connections
conn_repl = '''
        // -------------------------------------------------
        // 7. Connect StakeManager to vault
        // -------------------------------------------------
        vault.setStakeManager(address(stakeManager));
        vault.setPaymentEscrow(address(escrow));
        escrow.setCreatorAuthorization(address(vault), true);
        stakeManager.setLockerAuthorization(address(escrow), true);

        // -------------------------------------------------
'''
content = content.replace('''
        // -------------------------------------------------
        // 7. Connect StakeManager to vault
        // -------------------------------------------------
        vault.setStakeManager(address(stakeManager));

        // -------------------------------------------------
'''.strip(), conn_repl.strip())

# Replace vault.pay(...) with vault.createJob(...)
def repl_pay(m):
    req = m.group(1)
    prov = m.group(2)
    amt = m.group(3)
    return f'vault.createJob({req}, {prov}, {amt}, 10 * USDC, block.timestamp + 2 hours, keccak256("GPU_COMPUTE"))'

content = re.sub(r'vault\.pay\(([^,]+),\s*([^,]+),\s*([^)]+)\)', repl_pay, content)

# Fix assertions
content = content.replace('assertEq(usdc.balanceOf(provider), 60 * USDC);', 'assertEq(usdc.balanceOf(address(escrow)), 10 * USDC); // 10 was transferred to escrow')

with open('test/AgentSpendingVault.t.sol', 'w') as f:
    f.write(content)
