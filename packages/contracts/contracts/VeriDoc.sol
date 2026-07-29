// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title VeriDoc — batch-anchored document verification with three-state results
contract VeriDoc is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error BatchAlreadyExists(bytes32 batchId);
    error BatchNotFound(bytes32 batchId);
    error NotBatchIssuer(bytes32 batchId, address caller);
    error EmptyLeafArray();

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event BatchAnchored(
        bytes32 indexed batchId,
        bytes32 root,
        address indexed issuer,
        uint64 issuedAt,
        string metaURI
    );

    event CredentialRevoked(
        bytes32 indexed leaf,
        address indexed revokedBy,
        uint64 revokedAt,
        string reason
    );

    event IssuerRegistered(address indexed issuer, string name);

    // -------------------------------------------------------------------------
    // Storage structures
    // -------------------------------------------------------------------------

    struct Batch {
        bytes32 root;
        address issuer;
        uint64 issuedAt;
        string metaURI;
    }

    struct RevocationRecord {
        bool revoked;
        uint64 at;
        string reason;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    mapping(bytes32 batchId => Batch) private _batches;
    mapping(bytes32 leaf => RevocationRecord) private _revocations;
    mapping(address => string) private _issuerNames;

    // -------------------------------------------------------------------------
    // Verification result
    // -------------------------------------------------------------------------

    enum VerificationStatus {
        Unknown,
        Valid,
        Tampered,
        Revoked
    }

    struct VerificationResult {
        VerificationStatus status;
        address issuer;
        string issuerName;
        uint64 issuedAt;
        string metaURI;
        uint64 revokedAt;
        string revokeReason;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Grant ISSUER_ROLE and record a human-readable display name.
    function registerIssuer(
        address issuer,
        string calldata name
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ISSUER_ROLE, issuer);
        _issuerNames[issuer] = name;
        emit IssuerRegistered(issuer, name);
    }

    // -------------------------------------------------------------------------
    // Issuance
    // -------------------------------------------------------------------------

    /// @notice Anchor a Merkle root for a batch of credentials. Immutable once set.
    function anchorBatch(
        bytes32 batchId,
        bytes32 root,
        string calldata metaURI
    ) external onlyRole(ISSUER_ROLE) {
        if (_batches[batchId].issuedAt != 0) revert BatchAlreadyExists(batchId);

        uint64 ts = uint64(block.timestamp);
        _batches[batchId] = Batch({
            root: root,
            issuer: msg.sender,
            issuedAt: ts,
            metaURI: metaURI
        });

        emit BatchAnchored(batchId, root, msg.sender, ts, metaURI);
    }

    // -------------------------------------------------------------------------
    // Revocation
    // -------------------------------------------------------------------------

    /// @notice Revoke a single credential leaf. Only the batch's issuer may revoke.
    function revoke(
        bytes32 batchId,
        bytes32 leaf,
        string calldata reason
    ) external {
        _requireBatchIssuer(batchId);
        _revokeLeaf(leaf, reason);
    }

    /// @notice Revoke many credential leaves in one transaction.
    function revokeMany(
        bytes32 batchId,
        bytes32[] calldata leaves,
        string calldata reason
    ) external {
        if (leaves.length == 0) revert EmptyLeafArray();
        _requireBatchIssuer(batchId);
        for (uint256 i = 0; i < leaves.length; i++) {
            _revokeLeaf(leaves[i], reason);
        }
    }

    // -------------------------------------------------------------------------
    // Verification — view, zero gas for the caller
    // -------------------------------------------------------------------------

    /// @notice Verify a credential. Returns a rich result; costs no gas.
    function verify(
        bytes32 batchId,
        bytes32 leaf,
        bytes32[] calldata proof
    ) external view returns (VerificationResult memory result) {
        Batch storage batch = _batches[batchId];

        // Unknown batch
        if (batch.issuedAt == 0) {
            result.status = VerificationStatus.Unknown;
            return result;
        }

        result.issuer = batch.issuer;
        result.issuerName = _issuerNames[batch.issuer];
        result.issuedAt = batch.issuedAt;
        result.metaURI = batch.metaURI;

        // Check revocation before proof — revoked takes precedence over tampered
        RevocationRecord storage rev = _revocations[leaf];
        if (rev.revoked) {
            result.status = VerificationStatus.Revoked;
            result.revokedAt = rev.at;
            result.revokeReason = rev.reason;
            return result;
        }

        // Verify Merkle proof
        bool valid = MerkleProof.verify(proof, batch.root, leaf);
        result.status = valid ? VerificationStatus.Valid : VerificationStatus.Tampered;
    }

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    function getBatch(bytes32 batchId) external view returns (Batch memory) {
        return _batches[batchId];
    }

    function getRevocation(bytes32 leaf) external view returns (RevocationRecord memory) {
        return _revocations[leaf];
    }

    function issuerName(address issuer) external view returns (string memory) {
        return _issuerNames[issuer];
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _requireBatchIssuer(bytes32 batchId) internal view {
        Batch storage batch = _batches[batchId];
        if (batch.issuedAt == 0) revert BatchNotFound(batchId);
        if (batch.issuer != msg.sender) revert NotBatchIssuer(batchId, msg.sender);
    }

    function _revokeLeaf(bytes32 leaf, string calldata reason) internal {
        if (!_revocations[leaf].revoked) {
            uint64 ts = uint64(block.timestamp);
            _revocations[leaf] = RevocationRecord({revoked: true, at: ts, reason: reason});
            emit CredentialRevoked(leaf, msg.sender, ts, reason);
        }
    }
}
